import { createSessionClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";
import { ApiError, assertSameOrigin, json, parseJson, route } from "@/server/http";
import { RateLimiter, clientIp } from "@/server/rate-limit";

const limiter = new RateLimiter(8, 15 * 60_000); // 8 tentativas / 15 min por IP (por instância)

/**
 * POST /api/auth/login — login de administrador com e-mail e senha.
 * Cria a sessão (cookie httpOnly) somente se a conta estiver em admin_users;
 * contas sem permissão são deslogadas na hora.
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

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    throw new ApiError(403, "forbidden", "Esta conta não tem acesso ao painel.");
  }

  return json({ ok: true });
});
