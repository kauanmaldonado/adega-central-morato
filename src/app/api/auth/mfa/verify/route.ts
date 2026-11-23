import { createSessionClient } from "@/lib/supabase/server";
import { mfaVerifySchema } from "@/lib/validation";
import { ApiError, assertSameOrigin, json, parseJson, route } from "@/server/http";
import { loadMfaState } from "@/server/mfa";
import { RateLimiter, clientIp } from "@/server/rate-limit";

// Códigos têm 6 dígitos: limitar tentativas impede adivinhação por força bruta.
// O Supabase Auth também limita tentativas de verificação no servidor dele.
const ipLimiter = new RateLimiter(10, 15 * 60_000);
const userLimiter = new RateLimiter(6, 15 * 60_000);

/**
 * POST /api/auth/mfa/verify — 2ª etapa do login: confere o código de 6
 * dígitos do app autenticador. Se estiver certo, a sessão passa a "aal2" e o
 * painel é liberado.
 *
 * Corpo: { code: "123456", factorId?: uuid }
 * factorId só é enviado no primeiro acesso, para confirmar o app recém-cadastrado.
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  if (!ipLimiter.check(clientIp(req.headers))) {
    throw new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde 15 minutos.");
  }
  const { code, factorId } = await parseJson(req, mfaVerifySchema, 2 * 1024);

  const supabase = await createSessionClient();
  const state = await loadMfaState(supabase);
  if (!state) throw new ApiError(401, "unauthenticated", "Sua sessão expirou. Entre novamente.");
  if (!state.isAdminAccount) throw new ApiError(403, "forbidden", "Esta conta não tem acesso ao painel.");
  if (!userLimiter.check(state.userId)) {
    throw new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde 15 minutos.");
  }

  // Com app já cadastrado, sempre usa ele. No primeiro acesso, só aceita o
  // cadastro pendente desta própria conta.
  let target = state.verifiedFactorId;
  if (!target) {
    if (!factorId || !state.unverifiedFactorIds.includes(factorId)) {
      throw new ApiError(400, "mfa_not_enrolled", "Cadastre o app autenticador para continuar.");
    }
    target = factorId;
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: target, code });
  if (error) {
    // 422 (e não 401) para a tela não interpretar como sessão expirada
    throw new ApiError(422, "invalid_code", "Código incorreto ou expirado. Confira o app e tente de novo.", {
      code: "Código incorreto ou expirado.",
    });
  }

  // Confirma com o banco que a sessão agora tem acesso de administrador
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    throw new ApiError(403, "forbidden", "Não foi possível liberar o acesso. Entre novamente.");
  }
  return json({ ok: true });
});
