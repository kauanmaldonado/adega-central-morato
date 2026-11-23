# Domínio personalizado

Exemplo usado abaixo: `seudominio.com.br`, com o cardápio em `www.seudominio.com.br`, o domínio sem `www` redirecionando para ele e o **painel administrativo em `admin.seudominio.com.br`**. Troque pelo seu domínio.

> Este guia mostra a Vercel. Na Hostinger, veja o passo 6 de [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md); as partes 3 a 5 abaixo (variáveis, Supabase e conferência) valem igual.

## 1. Adicionar o domínio na Vercel

1. Project → **Settings → Domains → Add**.
2. Adicione `www.seudominio.com.br`.
3. Adicione também `seudominio.com.br` e escolha **Redirect to www.seudominio.com.br** (308).
4. Adicione `admin.seudominio.com.br` (sem redirecionamento). É o endereço próprio do painel.

A Vercel mostra os registros DNS exatos que precisam ser criados. **Use sempre os valores exibidos pela Vercel**, que podem ser específicos do seu projeto.

## 2. Configurar o DNS

No provedor do domínio (Registro.br, Cloudflare, GoDaddy…), crie os registros pedidos pela Vercel. Normalmente:

| Tipo | Nome | Valor |
|---|---|---|
| `A` | `@` (domínio sem www) | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `admin` | `cname.vercel-dns.com` |

**Registro.br:** em "DNS", escolha *Editar zona* (modo avançado) e crie os registros acima. Se preferir, use a opção da Vercel de delegar os *nameservers* para ela.

**Cloudflare:** deixe os registros com a nuvem **cinza (DNS only)**. O proxy laranja da Cloudflare interfere na emissão do certificado da Vercel.

A propagação costuma levar de minutos a algumas horas. A Vercel emite o certificado HTTPS automaticamente quando o DNS é reconhecido. Em **Domains**, o status passa a **Valid Configuration**.

## 3. Atualizar as variáveis

Na Vercel (**Settings → Environment Variables**):

| Variável | Novo valor | Ambientes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.seudominio.com.br` | Production |
| `CANONICAL_HOST` | `www.seudominio.com.br` | Production |
| `ADMIN_HOST` | `admin.seudominio.com.br` | Production |

`CANONICAL_HOST` faz o app redirecionar para o domínio oficial qualquer acesso de produção por outro endereço (por exemplo `adega.vercel.app`). Isso evita conteúdo duplicado em buscadores. O endereço do painel (`ADMIN_HOST`) nunca é redirecionado.

`ADMIN_HOST` faz o painel abrir **só** em `admin.seudominio.com.br`; no endereço do cardápio, `/admin` passa a dar "página não encontrada". Detalhes em [VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md).

Depois, **Redeploy** do último deploy de produção.

## 4. Atualizar o Supabase

**Authentication → URL Configuration**:
- **Site URL:** `https://www.seudominio.com.br`
- **Redirect URLs:** adicione `https://www.seudominio.com.br/**` e `https://admin.seudominio.com.br/**`

## 5. Conferir

```bash
curl -sI https://seudominio.com.br        | grep -i location   # → https://www.seudominio.com.br/
curl -sI https://adega.vercel.app         | grep -i location   # → https://www.seudominio.com.br/ (com CANONICAL_HOST)
curl -s  https://www.seudominio.com.br/api/health              # → {"ok":true,...}
curl -s  https://www.seudominio.com.br/robots.txt              # → Sitemap com o domínio novo, sem mencionar o painel
curl -sI https://www.seudominio.com.br/admin | head -1         # → 404 (painel não existe no endereço do cardápio)
curl -sI https://admin.seudominio.com.br | grep -i location    # → /admin
curl -s  https://admin.seudominio.com.br/robots.txt            # → Disallow: /
```

Entre no painel por `https://admin.seudominio.com.br`. A sessão (cookie) vale só para o endereço onde o login foi feito, então quem estava logado por outro endereço precisa entrar de novo, com senha e código.

## HSTS

O site envia `Strict-Transport-Security` com `includeSubDomains; preload`. Assim, os navegadores passam a usar **apenas HTTPS** neste domínio e em todos os subdomínios. Se algum subdomínio seu (de e-mail, sistema antigo etc.) ainda não tiver HTTPS, remova `includeSubDomains; preload` em `next.config.ts` antes de publicar.
