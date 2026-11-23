#!/usr/bin/env node
/**
 * Cria (ou promove) um administrador do painel.
 *
 * Uso (na SUA máquina, nunca na hospedagem):
 *   npm run create-admin -- email@dominio.com
 *   npm run create-admin -- email@dominio.com --reset-password   (troca a senha)
 *   npm run create-admin -- email@dominio.com --reset-mfa        (celular novo/perdido)
 *
 * Lê do .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (chave secreta — só para este script)
 *
 * Verificação em duas etapas: todo administrador entra com senha + código de
 * 6 dígitos de um app autenticador. O app é cadastrado no PRIMEIRO login no
 * painel (QR code). --reset-mfa apaga o app cadastrado, e o próximo login
 * pede um novo cadastro — faça esse login logo em seguida.
 *
 * - Se o e-mail ainda não existe no Supabase Auth, cria o usuário com a senha
 *   digitada (já confirmado) e o marca como administrador.
 * - Se já existe, apenas o marca como administrador (a senha não muda),
 *   a menos que --reset-password seja informado.
 */
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] ?? "").trim().toLowerCase();
const resetPassword = process.argv.includes("--reset-password");
const resetMfa = process.argv.includes("--reset-mfa");

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Uso: npm run create-admin -- email@dominio.com");

/** Lê a senha sem mostrar na tela. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = (s) => {
      if (!rl.stdoutMuted || s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Não foi possível listar usuários: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUserByEmail(email);

async function askNewPassword() {
  const password = await askHidden(`Senha para ${email} (mín. 12 caracteres): `);
  if (password.length < 12) fail("Use uma senha com pelo menos 12 caracteres.");
  const confirm = await askHidden("Repita a senha: ");
  if (password !== confirm) fail("As senhas não conferem.");
  return password;
}

if (!user) {
  const password = await askNewPassword();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Não foi possível criar o usuário: ${error.message}`);
  user = data.user;
  console.log(`✔ Usuário criado: ${email}`);
} else if (resetPassword) {
  const password = await askNewPassword();
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) fail(`Não foi possível trocar a senha: ${error.message}`);
  console.log(`✔ Senha de ${email} alterada.`);
} else {
  console.log(`• Usuário já existe: ${email} (senha mantida)`);
}

if (resetMfa) {
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
  if (error) fail(`Não foi possível ler a verificação em duas etapas: ${error.message}`);
  const factors = data?.factors ?? [];
  for (const factor of factors) {
    const { error: delError } = await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
    if (delError) fail(`Não foi possível remover o app autenticador: ${delError.message}`);
  }
  console.log(
    factors.length
      ? `✔ App autenticador removido (${factors.length}). No próximo login, ${email} cadastra um novo lendo o QR code.`
      : `• ${email} não tinha app autenticador cadastrado.`,
  );
}

const { error: adminError } = await supabase
  .from("admin_users")
  .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
if (adminError) fail(`Não foi possível marcar como administrador: ${adminError.message}`);

const adminUrl = process.env.ADMIN_HOST ? `https://${process.env.ADMIN_HOST.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/admin/login` : "/admin/login";
console.log(`✔ ${email} agora é administrador. Entre em ${adminUrl}`);
console.log("  No primeiro login, tenha o celular em mãos: o painel pede para cadastrar um app autenticador.\n");
