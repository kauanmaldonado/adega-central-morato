# Segurança

## Princípios

1. **O banco é a última linha de defesa.** Mesmo que alguém use a chave pública diretamente, fora do site, as políticas RLS e as funções do banco impedem leitura ou alteração indevida.
2. **Nada secreto no navegador nem no repositório.** O app em execução usa apenas a chave pública (anon/publishable). A chave secreta é usada só por um script local.
3. **Validação em três níveis:** formulário (conveniência), API com Zod (contrato) e banco com `CHECK`, `FOREIGN KEY` e funções (garantia).

## Endereço próprio do painel

- O painel só existe no endereço definido em `ADMIN_HOST` (ex.: `admin.seudominio.com.br`). As regras ficam em `src/lib/admin-host.ts` e são aplicadas pelo middleware em todas as requisições.
- No endereço do cardápio, `/admin`, `/api/admin/*` e `/api/auth/*` respondem **404**, como qualquer página inexistente. O cardápio não tem link para o painel, e o `robots.txt` do cardápio não menciona o painel.
- No endereço do painel, só as rotas do painel respondem. Todo o endereço é marcado para não ser indexado (`robots.txt` com `Disallow: /` e cabeçalho `X-Robots-Tag: noindex, nofollow`).
- Os cookies de sessão ficam presos ao endereço do painel (sem atributo `Domain`): o site dos clientes nunca os recebe.
- **Sem `ADMIN_HOST`, o painel fica desativado em produção.**
- O endereço separado **esconde** o painel, mas a proteção de verdade é o login e as regras do banco abaixo. Mesmo quem descobrir o endereço precisa do e-mail e da senha de um administrador.

## Autenticação de administradores

- Supabase Auth com e-mail e senha. O login acontece **no servidor** (`/api/auth/login`).
- **Sem verificação em duas etapas**, por decisão do dono do projeto: quem tiver o e-mail e a senha de um administrador entra no painel. Use uma senha longa e exclusiva (mínimo de 12 caracteres, exigido pelo Supabase) e guarde-a num gerenciador de senhas. Se um dia quiser reativar o código de 6 dígitos, a versão anterior está no histórico do Git (migration `20261123000100_admin_mfa.sql`).
- Ser usuário do Supabase **não basta**: o acesso exige um registro em `admin_users`, conferido pela função `is_admin()` em três pontos:
  - no login (conta sem permissão é deslogada na hora, antes de pedir o código);
  - em cada página do painel e em cada rota `/api/admin/*` (`requireAdminPage` / `requireAdminApi`);
  - em cada consulta ao banco (políticas RLS).
- A sessão é validada com `auth.getUser()`, que consulta o servidor de autenticação em vez de confiar só no cookie.
- Cookies de sessão: `httpOnly`, `SameSite=Lax`, `Secure` em produção.
- Rotas que alteram dados exigem cabeçalho `Origin` igual ao host (proteção contra CSRF).
- Login com mensagem genérica ("E-mail ou senha incorretos") e limite de 8 tentativas a cada 15 min por IP, somado aos limites do próprio Supabase Auth.
- Novos cadastros pelo Supabase devem ficar desativados (ver [INSTALACAO.md](INSTALACAO.md), passo 2). Administradores são criados apenas pelo script local.

## Controle de acesso no banco (RLS)

RLS está **ativo em todas as tabelas**. Além disso, privilégios desnecessários foram revogados (`REVOKE`), como defesa extra.

| Tabela | Visitante (anon) | Usuário logado sem ser admin | Administrador |
|---|---|---|---|
| `categories` | Lê ativas | Lê ativas | Tudo |
| `products` | Lê ativos de categorias ativas | Idem | Tudo |
| `product_variants` | Lê ativas de produtos visíveis | Idem | Tudo |
| `product_images` | Lê de produtos visíveis | Idem | Tudo |
| `store_settings` | Lê | Lê | Lê e altera |
| `customers` | — | — | Lê, altera nome |
| `orders` | — (só cria via `create_order`) | — | Lê; altera **apenas** `status`, `delivery_fee_cents`, `cancel_reason` |
| `order_items`, `order_events` | — | — | Lê |
| `admin_users` | — | Vê só o próprio registro | Vê só o próprio registro |

**Administrador** = usuário logado com registro em `admin_users`.

Regras extras garantidas no banco:
- Ninguém, nem o administrador, insere pedidos diretamente na tabela nem altera subtotal ou itens de um pedido.
- `create_order` **ignora preços enviados pelo navegador** e usa os do banco.
- Pedido concluído ou cancelado não muda mais de status. Cancelamento exige motivo.
- Limite de 5 pedidos por telefone a cada 10 minutos.
- Funções `SECURITY DEFINER` usam `search_path = ''` (proteção contra sequestro de `search_path`) e têm `EXECUTE` concedido só a quem precisa.

## Imagens (Supabase Storage)

- Bucket `product-images`: leitura pública (as fotos aparecem no cardápio). Envio, troca e exclusão **somente por administradores**, e apenas dentro de `products/`.
- O bucket aceita só JPEG, PNG e WebP até 5 MB. A API confere também a **assinatura real do arquivo** (os primeiros bytes), não a extensão. SVG e outros formatos que podem conter scripts são recusados.
- Os nomes de arquivo são gerados pelo servidor (`products/<id-do-produto>/<uuid>.<ext>`). O nome original enviado não é usado.
- Ao excluir um produto ou foto, o arquivo também é removido do Storage.

## Cabeçalhos HTTP

Definidos em `next.config.ts` para todas as rotas:
- `Content-Security-Policy`: scripts e conexões só do próprio site; imagens só do site e do Supabase; `frame-ancestors 'none'`.
- `Strict-Transport-Security` (2 anos, com `includeSubDomains; preload`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- O cabeçalho `X-Powered-By` foi removido.

## Dados pessoais (LGPD)

O sistema guarda nome, telefone e endereço de entrega dos clientes, apenas para atender os pedidos. Esses dados só podem ser lidos por administradores. Recomendações:
- Publique uma política de privacidade simples no rodapé, explicando para que os dados são usados.
- Para atender um pedido de exclusão, no SQL Editor apague os pedidos e depois o cliente, ou substitua nome e telefone por dados anonimizados.

## Testes de segurança incluídos

`npm run test:db` aplica as migrations num PostgreSQL descartável e executa **66 verificações**. Entre elas:
- o visitante não lê clientes, pedidos ou administradores e não altera nada;
- usuário logado sem ser admin não vê pedidos nem altera configurações;
- preço adulterado pelo navegador é ignorado;
- itens inativos não podem ser comprados;
- pedido concluído não volta de status;
- envio de imagem fora da pasta permitida é recusado.

Também foi feito um teste de mutação: ao abrir uma brecha de propósito (política de clientes liberada e verificação de itens ativos removida), os testes falharam como deveriam.

## Checklist de produção

- [ ] "Allow new users to sign up" **desativado** no Supabase Auth
- [ ] `ADMIN_HOST` definido e o painel **abrindo só** nesse endereço (no endereço do cardápio, `/admin` dá 404)
- [ ] Senha mínima de 12 caracteres no Supabase Auth
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **não** cadastrada na hospedagem (Hostinger/Vercel)
- [ ] Nenhum `.env*` com valores reais no repositório
- [ ] Projeto Supabase com backups ativos (planos pagos têm backup diário; no gratuito, exporte periodicamente com `npx supabase db dump`)
- [ ] Supabase → **Advisors → Security Advisor** sem alertas críticos
- [ ] `/api/health` monitorado
- [ ] Rate limit da Vercel Firewall para `/api/orders` e `/api/auth/login` (recomendado)
- [ ] Administradores com senhas únicas; remover o acesso de quem sair da equipe

## Limitações conhecidas

- O limite de requisições por IP dentro do app vale **por instância** da Vercel. Os limites que valem para tudo são os do banco (pedidos por telefone) e os do Supabase Auth (login). Para limite global por IP, use a Vercel Firewall.
- Não há redefinição de senha pelo próprio site: troque pelo painel do Supabase (Authentication → Users) ou com `npm run create-admin -- email --reset-password` (na sua máquina).
- A taxa de entrega é combinada pelo WhatsApp e registrada manualmente no pedido. Não há cálculo automático por endereço.
