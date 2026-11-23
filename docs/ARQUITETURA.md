# Arquitetura

## Visão geral

```
 Navegador (cliente / administrador)
   │  HTML + JS (React)        │  fetch /api/*  (JSON, cookie httpOnly)
   ▼                           ▼
 ┌──────────────────────── Next.js na Vercel (gru1) ────────────────────────┐
 │ FRONTEND  src/app (páginas) + src/components                             │
 │   • Cardápio e checkout: só exibem dados e enviam o pedido para a API     │
 │   • Painel: formulários que chamam /api/admin/*                          │
 │                                                                          │
 │ BACKEND   src/app/api/**/route.ts  →  src/server/*                       │
 │   • valida tudo com Zod (src/lib/validation.ts)                          │
 │   • confere sessão e papel de administrador                              │
 │   • fala com o Supabase com a chave pública + sessão do usuário          │
 └──────────────────────────────────────────────────────────────────────────┘
   │  PostgREST / Auth / Storage (HTTPS)
   ▼
 ┌──────────────────────────── Supabase (sa-east-1) ────────────────────────┐
 │ PostgreSQL com RLS • funções create_order / admin_save_product          │
 │ Auth (e-mail + senha) • Storage: bucket público "product-images"         │
 └──────────────────────────────────────────────────────────────────────────┘
```

### Divisão de responsabilidades

| Camada | Pasta | Responsabilidade | Não faz |
|---|---|---|---|
| Frontend | `src/app/**/page.tsx`, `src/components` | Interface, estado do carrinho, máscaras de campo, mensagens | Não acessa o Supabase pelo navegador; não decide preço nem permissão |
| Backend (API) | `src/app/api/**/route.ts` | Contrato HTTP: valida entrada, autentica, chama serviços, padroniza erros | Não contém SQL |
| Serviços | `src/server/*` | Consultas ao Supabase, regras de montagem (cardápio, upload, pedidos) | Não confia em dados não validados |
| Banco | `supabase/migrations` | Integridade, permissões (RLS), cálculo de preço do pedido, transições de status | — |
| Compartilhado | `src/lib` | Tipos, esquemas Zod, formatação de dinheiro e telefone, mensagem do WhatsApp | Não tem dependências de servidor |

As páginas do painel são componentes de servidor: carregam os dados usando os mesmos serviços de `src/server` e a sessão do administrador. **Todas as alterações** (criar, editar, excluir, enviar foto, mudar status) passam pelas rotas `/api/admin/*`. O navegador nunca fala direto com o Supabase. Por isso os cookies de sessão podem ser `httpOnly`, e a CSP bloqueia conexões a outros domínios.

## Modelo de dados

```
categories 1─┐
             └─< products 1─┬─< product_variants      (opção + preço + preço "de")
                            └─< product_images        (arquivo no Storage)

customers 1─< orders 1─┬─< order_items  (cópia do nome/opção/preço na hora da compra)
                       └─< order_events (histórico de status, preenchido por trigger)

admin_users   (quem pode usar o painel; referencia auth.users)
store_settings (linha única: nome, WhatsApp, horário, endereço, pedido mínimo, pagamentos, aberto/fechado)
```

Decisões importantes:
- **Dinheiro em centavos (`integer`):** sem erros de arredondamento.
- **Oferta** = variação com `compare_at_cents > price_cents`, garantido por `CHECK`.
- **Pedidos guardam uma cópia** do nome do produto, da opção e do preço. Editar ou excluir um produto não altera pedidos antigos.
- **`orders.code`** é um número sequencial legível (“Pedido nº 15”). `orders.id` (UUID) é usado nas URLs do painel.
- **`total_cents`** é coluna calculada (`subtotal + taxa de entrega`), sem risco de inconsistência.
- **Categoria com produtos não pode ser excluída** (`ON DELETE RESTRICT`). Para esconder do cardápio, ela é desativada.

## Fluxo de um pedido

1. O cliente monta o carrinho. O navegador guarda só **ids de opção e quantidades**.
2. `POST /api/orders` valida o formato (Zod) e chama a função `create_order` do banco.
3. `create_order` (SECURITY DEFINER, transação única):
   - confere se a loja está aberta e se a forma de pagamento é aceita;
   - **lê os preços do banco**, aceitando só opções ativas de produtos e categorias ativos;
   - aplica pedido mínimo e limite de 5 pedidos por telefone a cada 10 minutos;
   - cria ou atualiza o cliente pelo telefone, grava pedido, itens e histórico.
4. A API monta a mensagem do WhatsApp **com os dados gravados** e devolve o link `wa.me` para o número configurado no painel.
5. O pedido aparece no painel com status **Novo**. O administrador avança o status, informa a taxa de entrega ou cancela com motivo. Pedidos concluídos ou cancelados ficam travados.

## API

Todas as respostas são JSON. Em caso de erro, o formato é sempre:
`{ "error": { "code": "…", "message": "mensagem em português", "fields": { "campo": "mensagem" } } }`

### Pública

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/catalog` | Cardápio ativo + configurações públicas da loja |
| POST | `/api/orders` | Cria pedido. Body: `customer{name,phone}`, `fulfillment`, `payment_method`, `address?`, `notes?`, `items[{variant_id,quantity}]`. Resposta 201: `order{id,code,subtotal_cents,items}`, `whatsapp_url` |
| GET | `/api/health` | Saúde do app e do banco |
| POST | `/api/auth/login` | `{email,password}`. 1ª etapa: cria a sessão (cookie httpOnly, nível `aal1`) se a conta for de administrador e responde `{next:"enroll"\|"verify"}` |
| POST | `/api/auth/mfa/enroll` | Primeiro acesso: gera o QR code e a chave para cadastrar o app autenticador (só se a conta ainda não tiver um) |
| POST | `/api/auth/mfa/verify` | `{code, factorId?}`. 2ª etapa: confere o código de 6 dígitos; a sessão passa a `aal2` e o painel é liberado |
| POST | `/api/auth/logout` | Encerra a sessão |

### Administração (exigem sessão de administrador)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/me` | Administrador logado |
| GET / POST | `/api/admin/categories` | Listar (com nº de produtos) / criar |
| PATCH / DELETE | `/api/admin/categories/:id` | Renomear, ativar/desativar, posição / excluir (só sem produtos) |
| POST | `/api/admin/categories/reorder` | `{ids:[…]}` na nova ordem |
| GET / POST | `/api/admin/products` | Listar / criar produto com opções |
| GET / PUT / PATCH / DELETE | `/api/admin/products/:id` | Ler / substituir (dados + opções) / ligar-desligar `is_active`, `is_featured`, `is_new` / excluir (remove fotos do Storage) |
| POST | `/api/admin/products/:id/images` | `multipart/form-data`: `file` (JPG/PNG/WebP até 5 MB), `alt` |
| PATCH / DELETE | `/api/admin/images/:id` | Texto alternativo e posição / excluir |
| GET | `/api/admin/orders?status=&q=&page=` | Lista paginada (20 por página); `q` aceita nº do pedido, telefone ou nome |
| GET / PATCH | `/api/admin/orders/:id` | Detalhes com itens e histórico / `status`, `delivery_fee_cents`, `cancel_reason` |
| GET / PUT | `/api/admin/settings` | Configurações da loja |

Códigos HTTP usados: `201` criado, `401` sem login, `403` sem permissão ou origem inválida, `404`, `409` conflito (item indisponível, categoria em uso, status travado), `413` arquivo grande, `415` tipo inválido, `422` validação, `429` limite de tentativas.

## Cache

- O cardápio (`getCatalogCached`) fica em cache por 60 s com a tag `catalog`.
- Toda rota de administração que altera o cardápio chama `revalidateTag("catalog")`, e a mudança aparece imediatamente.
- As páginas do painel e todas as respostas de `/api/admin/*` usam `no-store`.
- `/admin`, `/api/admin/*` e `/api/auth/*` só existem no endereço `ADMIN_HOST`; no endereço do cardápio respondem 404 (`src/lib/admin-host.ts`, aplicado no middleware).
- O banco só reconhece administradores com sessão `aal2` (senha + código), em `is_admin()`.
