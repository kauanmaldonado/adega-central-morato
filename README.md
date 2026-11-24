# Adega Central Morato — cardápio digital e painel administrativo

Aplicação web da Adega Central Morato. O cliente monta o pedido no cardápio e o envia pelo WhatsApp. A equipe gerencia produtos, preços, fotos, categorias, pedidos e configurações da loja por um painel, sem mexer em código.

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript.
- **Backend:** rotas de API do Next.js (`/api/*`) com uma camada de serviços em `src/server`.
- **Banco, autenticação e arquivos:** Supabase (PostgreSQL, Auth e Storage), protegido por Row Level Security.
- **Hospedagem:** Vercel (região São Paulo, `gru1`).

## O que o sistema faz

| Área | Funcionalidades |
|---|---|
| Cardápio público (`/`) | Busca, filtro por categoria, ofertas, mais pedidos, novidades, opções de tamanho/sabor, carrinho |
| Checkout (`/checkout`) | Dados do cliente, entrega ou retirada, forma de pagamento, observações. O pedido é **gravado no banco** e gera a mensagem pronta para o WhatsApp |
| Painel (endereço próprio, ex. `admin.seudominio.com.br`) | Login de administrador com e-mail e senha, invisível para os clientes, resumo do dia, pedidos (filtros, status, taxa de entrega, cancelamento com motivo, histórico), produtos (CRUD, opções e preços, ofertas, fotos), categorias (CRUD, ordem, ativar/desativar), configurações da loja (WhatsApp, horário, endereço, pedido mínimo, formas de pagamento, loja aberta/fechada) |

O banco começa vazio. **Nenhum produto ou preço de exemplo é criado**: tudo é cadastrado pelo painel.

## Início rápido

```bash
npm install
cp .env.example .env.local        # preencha com os dados do seu projeto Supabase
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push              # cria tabelas, políticas e o bucket de imagens
npm run create-admin -- voce@seudominio.com.br
npm run dev                       # cardápio: http://localhost:3000  ·  painel: http://localhost:3000/admin
                                  # (com ADMIN_HOST=admin.localhost:3000, o painel fica em http://admin.localhost:3000)
```

O passo a passo completo está em [docs/INSTALACAO.md](docs/INSTALACAO.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/INSTALACAO.md](docs/INSTALACAO.md) | Criar o projeto Supabase, aplicar o banco, criar o administrador e rodar localmente |
| [docs/VARIAVEIS-DE-AMBIENTE.md](docs/VARIAVEIS-DE-AMBIENTE.md) | Todas as variáveis: o que são, onde obter e onde cadastrar |
| [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md) | Publicar na Vercel e conferir depois do deploy |
| [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) | Publicar na Hostinger (Node.js Web App) e conectar o domínio |
| [docs/DOMINIO-PERSONALIZADO.md](docs/DOMINIO-PERSONALIZADO.md) | Usar um domínio próprio (DNS, HTTPS, redirecionamento) |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Como frontend, backend e banco se dividem, modelo de dados e rotas da API |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Autenticação, RLS, validação, armazenamento de imagens e checklist de produção |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm test` | Testes unitários (validação, dinheiro, telefone, WhatsApp, erros, limitador) |
| `npm run test:db` | Testes do banco: migrations, RLS e regras de negócio num PostgreSQL descartável |
| `npm run create-admin -- email` | Cria ou promove um administrador (usa a chave secreta local) |

## Estrutura

```
supabase/migrations/   SQL do banco: tabelas, RLS, funções, bucket de imagens
supabase/tests/        testes de segurança do banco
scripts/               create-admin.mjs, test-db.sh
src/app/               páginas (cardápio, checkout, painel) e rotas /api
src/components/        componentes de interface (store = cardápio, admin = painel)
src/server/            backend: serviços de dados, autenticação, tratamento de erros
src/lib/               código compartilhado: tipos, validação (Zod), dinheiro, telefone
tests/                 testes unitários
```
