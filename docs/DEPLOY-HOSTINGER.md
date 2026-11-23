# Publicar na Hostinger

O projeto roda na Hostinger como **Node.js Web App** (aplicação Next.js em modo servidor). O banco, o login e as imagens continuam no **Supabase**; a Hostinger só hospeda o site e a API.

> Antes de publicar, conclua o [docs/INSTALACAO.md](INSTALACAO.md): projeto Supabase criado, migrations aplicadas e primeiro administrador criado.

## 1. Confira o plano

Node.js Web Apps estão disponíveis nos planos **Business** e **Cloud** (Startup, Professional, Enterprise, Enterprise Plus).

- Planos **Single/Premium** (hospedagem compartilhada comum) **não servem**: eles só hospedam sites estáticos/PHP, e este projeto precisa de servidor (API, login, pedidos).
- **VPS** também funciona, mas exige configurar tudo pela linha de comando (Node.js, PM2, Nginx, SSL). Este guia cobre o caminho pelo hPanel.

## 2. Coloque o código no GitHub (recomendado)

Pelo GitHub, cada `git push` na branch escolhida gera um novo deploy automaticamente.

```bash
cd adega-central-morato
git init
git add .
git commit -m "Adega Central Morato"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/adega-central-morato.git
git push -u origin main
```

Use um repositório **privado**. O `.gitignore` já impede o envio de `.env.local` e de qualquer arquivo `.env` com valores reais — confira com `git status` antes do primeiro commit.

**Alternativa sem GitHub:** compacte a pasta do projeto em `.zip` **sem** `node_modules`, `.next` e `.env.local`, e use a opção de upload de arquivo no passo 3.

## 3. Crie o Web App no hPanel

1. hPanel → **Websites** → **Adicionar site** (Add Website).
2. Escolha **Node.js Web App**.
3. Escolha **Importar repositório Git** e autorize o GitHub (ou **Enviar arquivo** para o `.zip`).
4. Selecione o repositório e a branch `main`.
5. Confira as configurações de build (a Hostinger detecta o Next.js sozinha):

| Campo | Valor |
|---|---|
| Framework / tipo de aplicação | Next.js |
| Versão do Node.js | **22** (mínimo 20) |
| Comando de build | `npm run build` |
| Comando de start | `npm run start` |
| Diretório de saída | `.next` |

A Hostinger adiciona `output: "standalone"` automaticamente na hora do build — não é preciso mudar o `next.config.ts`. O arquivo exporta um objeto de configuração, que é o formato exigido.

## 4. Cadastre as variáveis de ambiente

No Web App, abra **Variáveis de ambiente** e cadastre **antes do primeiro build** (as variáveis `NEXT_PUBLIC_*` são gravadas no código durante o build; se mudar alguma depois, faça um novo deploy):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave **pública** (anon/publishable) do Supabase |
| `NEXT_PUBLIC_SITE_URL` | Endereço do site, ex. `https://www.seudominio.com.br` (enquanto não houver domínio, o endereço temporário da Hostinger) |
| `ADMIN_HOST` | Endereço do painel, ex. `admin.seudominio.com.br` (ver passo 6). **Sem ela, o painel fica desativado.** |
| `CANONICAL_HOST` | Opcional — só depois que o domínio estiver funcionando, ex. `www.seudominio.com.br` |

**Não cadastre `SUPABASE_SERVICE_ROLE_KEY` na Hostinger.** O site não usa essa chave; ela serve só para o script de criação de administrador, rodado na sua máquina. Se a chave secreta for colocada por engano no lugar da pública, o app se recusa a iniciar.

Detalhes de cada variável: [docs/VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md).

## 5. Faça o deploy

Clique em **Deploy**. A Hostinger instala as dependências, roda o build e inicia o servidor. Acompanhe os **logs de build** no hPanel; se falhar, copie a mensagem de erro.

## 6. Conecte o domínio

### Domínio registrado na própria Hostinger
No Web App, vá em **Domínios** e conecte o domínio. A Hostinger configura o DNS e o certificado HTTPS (SSL gratuito) sozinha.

### Domínio registrado em outro lugar (Registro.br, GoDaddy…)
Aponte o domínio para a Hostinger seguindo as instruções que aparecem no hPanel ao adicionar o domínio — o mais simples é trocar os **nameservers** no seu registrador pelos da Hostinger. A propagação pode levar algumas horas. O SSL é emitido depois que o DNS propaga.

### Endereço próprio do painel (`admin.seudominio.com.br`)

O painel administrativo não abre no endereço do cardápio: ele tem um subdomínio próprio, definido em `ADMIN_HOST`. É o **mesmo código**, só respondendo em outro endereço. Na Hostinger, cada Web App fica ligado a um endereço, então:

1. Crie um **segundo Node.js Web App** (passo 3) a partir do **mesmo repositório e da mesma branch**. O plano Business permite mais de um Web App.
2. Cadastre nele **exatamente as mesmas variáveis** do primeiro (passo 4), incluindo o mesmo `ADMIN_HOST`.
3. Conecte a esse segundo Web App o subdomínio `admin.seudominio.com.br`. Se o domínio usa os nameservers da Hostinger, o subdomínio passa a funcionar sozinho. Se o DNS está em outro lugar, crie o registro que o hPanel indicar para o subdomínio.
4. Faça o deploy. A cada `git push`, os dois Web Apps se atualizam. Confira se os dois estão com o deploy automático ligado.

Se o hPanel permitir conectar o subdomínio como **domínio adicional do mesmo Web App**, isso também funciona, e aí não precisa do segundo Web App.

Antes de ter o domínio próprio, você pode usar o endereço temporário do segundo Web App como `ADMIN_HOST`. Depois, troque pelo subdomínio definitivo e faça um novo deploy dos dois.

### Depois que o domínio estiver no ar
1. Atualize `NEXT_PUBLIC_SITE_URL` para `https://www.seudominio.com.br` (com `https://`, sem barra no final).
2. Opcional: defina `CANONICAL_HOST=www.seudominio.com.br` para que o endereço temporário e o domínio sem `www` redirecionem para o oficial. O endereço do painel (`ADMIN_HOST`) nunca é redirecionado.
3. Faça um novo deploy (as variáveis `NEXT_PUBLIC_*` só valem após rebuild).
4. **No Supabase** → Authentication → URL Configuration:
   - **Site URL:** `https://www.seudominio.com.br`
   - **Redirect URLs:** adicione `https://www.seudominio.com.br/**` e `https://admin.seudominio.com.br/**`

## 7. Confira depois do deploy

- [ ] `https://SEU-DOMINIO/api/health` responde `{"ok":true,...}`
- [ ] O cardápio abre (vazio até você cadastrar produtos)
- [ ] `https://SEU-DOMINIO/admin` mostra **"página não encontrada"** (o painel não existe no endereço do cardápio)
- [ ] O rodapé do cardápio **não** tem link para o painel
- [ ] `https://admin.SEU-DOMINIO` abre o login do painel
- [ ] Primeiro login: depois da senha, aparece o QR code; cadastre o app autenticador no celular e digite o código
- [ ] Saia e entre de novo: depois da senha, o painel pede o código de 6 dígitos
- [ ] Cadastrar categoria, produto com preço e foto
- [ ] Em **Configurações**, cadastrar o número do WhatsApp da loja
- [ ] Fazer um pedido de teste pelo cardápio, ver o pedido no painel, depois cancelá-lo com o motivo "teste"
- [ ] O cadeado de HTTPS aparece no navegador

## Diferenças em relação à Vercel

| Item | Hostinger | Vercel |
|---|---|---|
| `vercel.json` | Ignorado (pode ficar no projeto) | Usado (região São Paulo) |
| Limite de pedidos por IP na API | Funciona bem (um processo fixo) | Por instância (o limite principal fica no banco: 5 pedidos por telefone a cada 10 min) |
| Prévias por branch | Não | Sim |
| Local do servidor | Data center escolhido na Hostinger — prefira **Brasil/América do Sul** se disponível, perto do Supabase | `gru1` (São Paulo) |

Escolha a região do projeto Supabase e o data center da Hostinger próximos um do outro (ex.: ambos em São Paulo) para o site responder mais rápido.

## Problemas comuns

- **Build ou início falha com "Configuração inválida"** → faltou cadastrar alguma `NEXT_PUBLIC_*` antes do build, ou o valor tem espaço/aspas a mais.
- **Login no painel não mantém a sessão** → o site precisa estar em `https://`; confira o SSL e a configuração de URL no Supabase (passo 6.4).
- **Fotos não aparecem** → confira se `NEXT_PUBLIC_SUPABASE_URL` é exatamente a URL do projeto (as imagens só são liberadas desse endereço).
- **Mudei uma variável e nada aconteceu** → faça um novo deploy.
