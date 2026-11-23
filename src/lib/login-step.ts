/**
 * Regras puras da tela de login em duas etapas (sem dependências de servidor,
 * para poderem ser testadas). A leitura do estado está em src/server/mfa.ts.
 */

export type LoginStep = "credentials" | "enroll" | "verify" | "done";

export interface MfaState {
  userId: string;
  email: string | null;
  /** O usuário está na lista de administradores (independe do código). */
  isAdminAccount: boolean;
  /** "aal1" (só senha) ou "aal2" (senha + código). */
  aal: "aal1" | "aal2" | null;
  /** App autenticador já cadastrado e confirmado. */
  verifiedFactorId: string | null;
  /** Cadastros iniciados e não concluídos (QR code gerado e não confirmado). */
  unverifiedFactorIds: string[];
}

/** Qual tela de login mostrar para este estado. */
export function nextLoginStep(state: MfaState | null): LoginStep {
  if (!state || !state.isAdminAccount) return "credentials";
  if (state.aal === "aal2" && state.verifiedFactorId) return "done";
  return state.verifiedFactorId ? "verify" : "enroll";
}

/** Garante que o QR code venha como URL de imagem (data:). */
export function qrCodeDataUrl(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}
