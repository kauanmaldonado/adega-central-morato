import { createSessionClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";
import { nextLoginStep } from "@/lib/login-step";
import { ApiError, assertSameOrigin, json, parseJson, route } from "@/server/http";
import { loadMfaState } from "@/server/mfa";
import { RateLimiter, clientIp } from "@/server/rate-limit";

const limiter = new RateLimiter(8, 15 * 60_000); // 8 tentativas / 15 min por IP (por instância)

/**
 * POST /api/auth/login — 1ª etapa do login de administrador (e-mail e senha).
 *
 * Responde qual é a próxima etapa:
 *  - "enroll": primeiro acesso — cadastrar o app autenticador (QR code);
 *  - "verify": digitar o código de 6 dígitos do app autenticador.
 * Sem a 2ª etapa a sessão não tem acesso a nenhum dado (o banco exige aal2).
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  if (!limiter.check(clientIp(req.headers))) {
    throw new ApiError(429, "rate_limited", "Muitas tentativas de login. Aguarde 15 minutos.");
  }
  const { email, password } = await parseJson(req, loginSchema, 4 * 1024);
  const supabase = await createSessionClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensagem genérica: não revela se o e-mail existe
    throw new ApiError(401, "invalid_credentials", "E-mail ou senha incorretos.");
  }

  const state = await loadMfaState(supabase);
  if (!state?.isAdminAccount) {
    await supabase.auth.signOut();
    throw new ApiError(403, "forbidden", "Esta conta não tem acesso ao painel.");
  }

  const next = nextLoginStep(state);
  return json({ next: next === "done" ? "verify" : next });
});
