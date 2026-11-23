# Instalação e configuração

Tempo estimado: 20 a 30 minutos.

## Pré-requisitos

- Node.js 20.9 ou superior (`node -v`)
- Conta no [Supabase](https://supabase.com)
- Hospedagem com suporte a Node.js: [Hostinger](https://www.hostinger.com.br) (planos **Business** ou **Cloud**) ou [Vercel](https://vercel.com)
- Git e um repositório (GitHub, GitLab ou Bitbucket) para o deploy

## 1. Criar o projeto no Supabase

1. Em supabase.com, clique em **New project**.
2. **Region:** escolha **South America (São Paulo)**. Deixe a hospedagem perto do banco para o site responder mais rápido: na Hostinger, escolha um data center no Brasil/América do Sul, se disponível; a Vercel já está configurada para São Paulo (`gru1`).
3. Defina uma senha forte para o banco e guarde num gerenciador de senhas.
4. Depois de criado, anote em **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - chave **anon** (ou **publishable**) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - chave **service_role** (ou **secret**) → `SUPABASE_SERVICE_ROLE_KEY`. Fica só no seu computador, nunca na Hostinger nem na Vercel.
   - **Project ref**: o identificador na URL do painel (`https://supabase.com/dashboard/project/<ref>`).

## 2. Configurar a autenticação

Em **Authentication → Sign In / Providers** (os nomes podem variar um pouco conforme a versão do painel):

- **Desative "Allow new users to sign up".** Administradores são criados apenas pelo script do passo 5. Mesmo que alguém crie uma conta, ela não tem acesso a nada (o banco exige que o usuário esteja na tabela `admin_users`), mas não há motivo para deixar o cadastro aberto.
- Em **Email**, mantenha "Confirm email" ativado.
- Em **Authentication → Policies/Passwords**, defina tamanho mínimo de senha **12** e, se o seu plano permitir, ative a proteção contra senhas vazadas.
- Em **Authentication → Multi-Factor** (ou **MFA**), confirme que **TOTP (App Authenticator)** está **ativado**. É ele que gera o código de 6 dígitos pedido no login do painel. Em projetos novos já vem ativado.
- Em **Authentication → URL Configuration**, preencha **Site URL** com o endereço do site (em desenvolvimento, `http://localhost:3000`; em produção, o domínio, ver [DOMINIO-PERSONALIZADO.md](DOMINIO-PERSONALIZADO.md)).

## 3. Instalar o projeto

```bash
npm install
cp .env.example .env.local
```

Preencha o `.env.local` conforme [VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md). O arquivo está no `.gitignore` e não vai para o repositório.

## 4. Criar o banco de dados

As migrations em `supabase/migrations/` criam tudo: tabelas, políticas de segurança (RLS), funções, regras de pedidos e o bucket de imagens `product-images`.

**Opção A, com a Supabase CLI (recomendada):**

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

**Opção B, pelo painel:** abra **SQL Editor** e execute o conteúdo de cada arquivo de `supabase/migrations/`, **na ordem do nome** (`…000100_schema.sql`, `…000200_security.sql`, `…000300_functions.sql`, `…000400_storage.sql`).

Confira em **Table Editor** se as tabelas `categories`, `products`, `product_variants`, `product_images`, `customers`, `orders`, `order_items`, `order_events`, `admin_users` e `store_settings` existem, e em **Storage** se o bucket `product-images` aparece como público.

## 5. Criar o primeiro administrador

```bash
npm run create-admin -- voce@seudominio.com.br
```

O script pede a senha (mínimo 12 caracteres, não aparece na tela), cria o usuário já confirmado e o registra em `admin_users`. Para outros administradores, rode de novo com outro e-mail.

**Código de 6 dígitos (verificação em duas etapas):** todo login no painel pede, depois da senha, um código gerado por um app autenticador no celular (Google Authenticator, Microsoft Authenticator, Authy…). No **primeiro login**, o painel mostra um QR code para cadastrar o app. Faça esse primeiro login **logo depois de criar o administrador**, com o celular em mãos. O próprio banco exige o código: só com a senha não se acessa nenhum dado.

- **Celular novo ou perdido:** `npm run create-admin -- email --reset-mfa` apaga o app cadastrado; no próximo login o painel mostra um novo QR code. Se o celular foi perdido ou roubado, troque também a senha (`--reset-password`).

- **Trocar a senha de um administrador:** `npm run create-admin -- email --reset-password`
- **Remover o acesso de alguém:** no SQL Editor:
  ```sql
  delete from public.admin_users
  where user_id = (select id from auth.users where email = 'pessoa@dominio.com');
  ```

O script usa a chave secreta do `.env.local`. Depois de criar os administradores, você pode apagar a `SUPABASE_SERVICE_ROLE_KEY` do arquivo: o site não precisa dela.

## 6. Rodar localmente

```bash
npm run dev
```

- Cardápio: http://localhost:3000. Aparece "Cardápio em preparação" até haver produtos.
- Painel: http://localhost:3000/admin (com `ADMIN_HOST` vazio no `.env.local`).

Para testar no seu computador a separação de endereços que vale em produção, coloque `ADMIN_HOST=admin.localhost:3000` no `.env.local`, reinicie o `npm run dev` e abra:

- Painel: http://admin.localhost:3000 (leva ao login)
- Cardápio: http://localhost:3000. Aqui, `/admin` passa a mostrar "página não encontrada".

## 7. Primeiros cadastros (pelo painel)

1. **Configurações:** número de WhatsApp que recebe os pedidos, endereço, horário, informações de entrega, formas de pagamento e pedido mínimo (opcional).
2. **Categorias:** crie as categorias na ordem em que devem aparecer.
3. **Produtos:** para cada produto, informe nome, categoria e pelo menos uma opção com preço. Salve e depois envie as fotos.
4. Abra o cardápio e faça um pedido de teste. Ele aparece em **Pedidos**. Se quiser, cancele-o informando o motivo "teste".

## 8. Verificar antes de publicar

```bash
npm run typecheck   # tipos
npm test            # testes unitários
npm run build       # build de produção
```

Para testar o banco localmente (opcional), com um PostgreSQL 15+ instalado:

```bash
PGHOST=localhost PGUSER=postgres npm run test:db
```

O script cria um banco temporário `adega_test`, aplica as migrations, roda os testes de segurança e o apaga ao final. **Nunca aponte para o banco de produção.**

Depois publique o site:

- **Hostinger:** [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md)
- **Vercel:** [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)
