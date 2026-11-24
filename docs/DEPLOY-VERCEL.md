# Deploy na Vercel

O projeto já vem preparado para a Vercel:
- `vercel.json` fixa as funções na região **São Paulo (`gru1`)**, perto do banco Supabase em São Paulo.
- O cardápio é servido a partir de um cache de dados (60 s), renovado na hora sempre que algo é alterado no painel.
- O build **não depende do banco**: as páginas leem os dados quando são acessadas.

## 1. Enviar o código para um repositório

```bash
git init
git add .
git commit -m "Adega Central Morato"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/adega-central-morato.git
git push -u origin main
```

Antes do primeiro commit, confirme que nenhum segredo vai junto:

```bash
git status --ignored | grep -E "\.env" || true    # .env.local deve aparecer como ignorado
git grep -nE "service_role|sb_secret_|eyJhbGci" -- . ':!docs' ':!.env.example' || echo "nenhuma chave no código"
```

## 2. Importar na Vercel

1. vercel.com → **Add New… → Project** → escolha o repositório.
2. **Framework Preset:** Next.js (detectado automaticamente). Não altere os comandos de build.
3. Em **Environment Variables**, cadastre as variáveis de [VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`: por enquanto, o endereço `https://<projeto>.vercel.app` que a Vercel vai mostrar. Ajuste depois do domínio.
   - `ADMIN_HOST`: o endereço próprio do painel, ex. `admin.seudominio.com.br` (em **Production**). Sem ela, o painel fica desativado. Enquanto não houver domínio, você pode adicionar um segundo endereço `*.vercel.app` ao projeto (Settings → Domains) e usá-lo aqui.
   - **Não** cadastre `SUPABASE_SERVICE_ROLE_KEY`.
4. Clique em **Deploy**.

> Se o build falhar com "Configuração inválida", falta alguma variável. A mensagem diz qual.

## 3. Configurar o Supabase para o endereço publicado

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://<projeto>.vercel.app` (ou o domínio próprio, quando houver).
- **Redirect URLs:** adicione o mesmo endereço e o endereço do painel (`ADMIN_HOST`).

## 4. Conferir o deploy

| Verificação | Como | Resultado esperado |
|---|---|---|
| App e banco conectados | Abrir `https://SEU-SITE/api/health` | `{"ok":true,"database":"ok",…}` |
| Cardápio | Abrir `/` | Logo e "Cardápio em preparação" ou os produtos |
| Painel escondido | Abrir `/admin` no endereço do cardápio | Página "não encontrada" (404) |
| Painel protegido | Abrir o endereço do painel (`ADMIN_HOST`) sem login | Leva a `/admin/login` |
| Login | Entrar com o administrador | Painel "Início" |
| API protegida | Abrir `https://ADMIN_HOST/api/admin/orders` numa aba anônima | `401` com `"unauthenticated"` |
| Cadastro | Criar categoria e produto com foto | Aparece no cardápio em segundos |
| Pedido | Fazer um pedido de teste | Aparece em Pedidos com número; o botão abre o WhatsApp |
| Cabeçalhos | `curl -sI https://SEU-SITE/ \| grep -iE "content-security\|strict-transport"` | Os dois cabeçalhos presentes |

## 5. Atualizações futuras

- **Código:** cada `git push` na `main` gera um deploy de produção. Pull requests geram prévias (Preview).
- **Banco:** quando houver novas migrations em `supabase/migrations/`, rode `npx supabase db push` **antes** de publicar o código que depende delas.
- **Produtos, preços, fotos, horários:** sempre pelo painel, sem deploy.

## Monitoramento (recomendado)

- Cadastre `https://SEU-SITE/api/health` num serviço de monitoramento (UptimeRobot, Better Stack…) para ser avisado se o site ou o banco caírem.
- Vercel → **Logs** mostra erros das rotas de API. Erros internos aparecem com o prefixo `[api]`, `[db]` ou `[storage]`.
- Para limitar abuso de forma global (além dos limites já existentes), ative regras de rate limit em **Vercel → Firewall** para `/api/orders` e `/api/auth/login`.
