import "server-only";
import type { SessionClient } from "@/lib/supabase/server";
import type { MfaState } from "@/lib/login-step";

/**
 * Verificação em duas etapas (TOTP) dos administradores.
 *
 * Etapa 1: e-mail e senha (sessão "aal1").
 * Etapa 2: código de 6 dígitos do app autenticador (sessão "aal2").
 *
 * O banco só reconhece administradores com sessão aal2 (ver is_admin() na
 * migration 20261123000100_admin_mfa.sql), então pular a etapa 2 na tela ou
 * na API não dá acesso a nada.
 */

/** Lê o estado de login/verificação da sessão atual. Null se não houver sessão. */
export async function loadMfaState(supabase: SessionClient): Promise<MfaState | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // A política RLS permite ao usuário ver apenas o próprio registro
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = (factors?.all ?? []).filter((f) => f.factor_type === "totp");
  const verified = totp.find((f) => f.status === "verified");

  const level = aalData?.currentLevel;
  return {
    userId: user.id,
    email: user.email ?? null,
    isAdminAccount: !!adminRow,
    aal: level === "aal1" || level === "aal2" ? level : null,
    verifiedFactorId: verified?.id ?? null,
    unverifiedFactorIds: totp.filter((f) => f.status !== "verified").map((f) => f.id),
  };
}
