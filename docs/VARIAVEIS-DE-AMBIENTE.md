# Variáveis de ambiente

O modelo completo está em [`.env.example`](../.env.example). Em desenvolvimento, as variáveis ficam em `.env.local`. Na Hostinger, ficam em **Web App → Variáveis de ambiente**; na Vercel, em **Project → Settings → Environment Variables**. Arquivos `.env*` com valores reais **nunca** vão para o repositório (estão no `.gitignore`).

## Resumo

| Variável | Obrigatória | Pública? | Onde cadastrar | Para quê |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Sim | `.env.local` e hospedagem (Hostinger ou Vercel) | Endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Sim | `.env.local` e hospedagem (Hostinger ou Vercel) | Chave pública do Supabase (acesso limitado pelo RLS) |
| `NEXT_PUBLIC_SITE_URL` | Recomendada | Sim | `.env.local` e hospedagem (Hostinger ou Vercel) | Endereço do site: SEO, sitemap, links de compartilhamento |
| `ADMIN_HOST` | **Sim, em produção** | Não | `.env.local` (opcional) e hospedagem | Endereço próprio do painel administrativo |
| `CANONICAL_HOST` | Opcional | Não | Hospedagem (na Vercel: só Production) | Domínio oficial para redirecionamento |
| `SUPABASE_SERVICE_ROLE_KEY` | Só para o script | **Secreta** | **Somente `.env.local`** | Criar administradores com `npm run create-admin` |

Variáveis que começam com `NEXT_PUBLIC_` são embutidas no código enviado ao navegador. Por isso, **apenas valores públicos por natureza** usam esse prefixo.

## Detalhes

### `NEXT_PUBLIC_SUPABASE_URL`
- **Onde obter:** Supabase → Project Settings → API → *Project URL*.
- **Formato:** `https://abcdefghijklmnop.supabase.co`
- Também libera as imagens do Storage na política de segurança de conteúdo (CSP) e no `next/image`. Se mudar, faça um novo deploy.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Onde obter:** Supabase → Project Settings → API Keys → chave **anon** (formato JWT, começa com `eyJ…`) ou a nova **publishable** (`sb_publishable_…`). As duas funcionam.
- **É pública:** qualquer visitante poderia obtê-la. O que protege os dados são as políticas RLS do banco (ver [SEGURANCA.md](SEGURANCA.md)). Com ela, um visitante só consegue ler o cardápio ativo e criar pedidos pela função validada `create_order`.
- **Proteção contra engano:** se você colar aqui a chave service_role ou uma `sb_secret_…`, o app **se recusa a iniciar** e mostra o erro.

### `NEXT_PUBLIC_SITE_URL`
- **Valor:** endereço público do site, **sem barra no final**.
  - Desenvolvimento: `http://localhost:3000`
  - Produção: `https://www.seudominio.com.br` (ou o `*.vercel.app` enquanto não houver domínio)
- **Uso:** `metadataBase` (imagens e links de compartilhamento), `robots.txt` e `sitemap.xml`.

### `ADMIN_HOST`
- **Valor:** apenas o host do painel, sem `https://` e sem barra. Exemplo: `admin.seudominio.com.br`
- **Efeito:**
  - O painel (`/admin`) e as rotas de login (`/api/auth/*`) e de administração (`/api/admin/*`) **só respondem nesse endereço**.
  - No endereço do cardápio essas rotas respondem **404 (página não encontrada)**, como se não existissem. O cardápio não tem nenhum link para o painel.
  - No endereço do painel, a raiz (`/`) leva ao login do painel e as páginas do cardápio respondem 404. O endereço inteiro fica marcado para não ser indexado por buscadores (`robots.txt` e `X-Robots-Tag`).
  - Os cookies de sessão do administrador ficam presos ao endereço do painel; o site dos clientes nunca os recebe.
- **Sem `ADMIN_HOST` em produção, o painel fica desativado** (404 em todo lugar). Isso evita que ele fique exposto no endereço do cardápio por esquecimento.
- **Em desenvolvimento** pode ficar vazia (painel em `http://localhost:3000/admin`). Para testar a separação no seu computador, use `ADMIN_HOST=admin.localhost:3000` e abra `http://admin.localhost:3000` (navegadores como Chrome, Edge e Firefox entendem `*.localhost` sem configuração).
- **O mesmo valor vai nos dois endereços.** Na Hostinger, cadastre `ADMIN_HOST` igual nos dois Web Apps (cardápio e painel); na Vercel, uma vez no projeto.
- O subdomínio precisa apontar para a hospedagem — veja [DOMINIO-PERSONALIZADO.md](DOMINIO-PERSONALIZADO.md).

### `CANONICAL_HOST` (opcional)
- **Valor:** apenas o host, sem `https://`. Exemplo: `www.seudominio.com.br`
- **Efeito:** em produção, qualquer acesso por outro host (por exemplo `adega.vercel.app`, o endereço temporário da Hostinger ou o domínio sem `www`) é redirecionado com código 308 para este host. Na Vercel, prévias de deploy (Preview) não são afetadas. Em outras hospedagens, como a Hostinger, vale sempre que o app roda em produção.
- Cadastre **somente no ambiente Production** da Vercel e só depois que o domínio estiver funcionando.

### `SUPABASE_SERVICE_ROLE_KEY` (secreta)
- **Onde obter:** Supabase → Project Settings → API Keys → **service_role** (legada) ou **secret** (`sb_secret_…`).
- **Ignora todas as regras de segurança do banco.** Quem tiver essa chave pode ler e alterar tudo.
- **Usada apenas** pelo script `scripts/create-admin.mjs`, executado na sua máquina.
- **Não cadastre na hospedagem (Hostinger ou Vercel).** O aplicativo não usa essa chave em nenhuma página ou rota.
- Se ela vazar: Supabase → API Keys → gere uma nova chave (*roll*). A chave antiga deixa de funcionar.

## Variáveis definidas automaticamente

| Variável | Definida por | Uso no projeto |
|---|---|---|
| `NODE_ENV` | Next.js | Cookies `Secure`, CSP mais rígida e painel desativado sem `ADMIN_HOST` em produção |
| `VERCEL_ENV` | Vercel | Limita o redirecionamento de `CANONICAL_HOST` à produção |

## Como cadastrar na Vercel

1. Project → **Settings → Environment Variables**.
2. Adicione `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL`, marcando **Production**, **Preview** e **Development**.
3. Adicione `ADMIN_HOST` (ex.: `admin.seudominio.com.br`) em **Production**. Em **Preview**, use o endereço de prévia que for usar para testar o painel, ou deixe sem — aí o painel fica desativado nas prévias.
4. Se usar domínio próprio, adicione `CANONICAL_HOST` apenas em **Production**.
5. Faça um novo deploy (**Deployments → … → Redeploy**). Variáveis `NEXT_PUBLIC_*` só entram em vigor num build novo.

Para usar as variáveis da Vercel localmente: `npx vercel link` e depois `npx vercel env pull .env.local`.
