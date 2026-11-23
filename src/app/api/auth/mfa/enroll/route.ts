import { createSessionClient } from "@/lib/supabase/server";
import { qrCodeDataUrl } from "@/lib/login-step";
import { ApiError, assertSameOrigin, json, route } from "@/server/http";
import { loadMfaState } from "@/server/mfa";
import { RateLimiter, clientIp } from "@/server/rate-limit";

const limiter = new RateLimiter(10, 15 * 60_000);

/**
 * POST /api/auth/mfa/enroll — primeiro acesso de um administrador: gera o QR
 * code para cadastrar o app autenticador (Google Authenticator, Microsoft
 * Authenticator, Authy…). Só funciona enquanto a conta ainda não tem um app
 * cadastrado; depois disso, trocar de celular exige o script
 * `npm run create-admin -- email --reset-mfa`.
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  if (!limiter.check(clientIp(req.headers))) {
    throw new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde 15 minutos.");
  }
  const supabase = await createSessionClient();
  const state = await loadMfaState(supabase);
  if (!state) throw new ApiError(401, "unauthenticated", "Faça login para continuar.");
  if (!state.isAdminAccount) throw new ApiError(403, "forbidden", "Esta conta não tem acesso ao painel.");
  if (state.verifiedFactorId) {
    throw new ApiError(409, "already_enrolled", "Esta conta já tem um app autenticador cadastrado. Digite o código dele.");
  }

  // Descarta cadastros iniciados e não concluídos (QR codes antigos)
  for (const factorId of state.unverifiedFactorIds) {
    await supabase.auth.mfa.unenroll({ factorId });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Adega Central Morato",
    friendlyName: "Painel Adega Central Morato",
  });
  if (error || !data) {
    console.error("[mfa.enroll]", error);
    throw new ApiError(502, "mfa_enroll_failed", "Não foi possível gerar o QR code. Tente novamente.");
  }

  return json({
    factorId: data.id,
    qrCode: qrCodeDataUrl(data.totp.qr_code),
    // Chave para digitar no app caso não seja possível ler o QR code
    secret: data.totp.secret,
  });
});
