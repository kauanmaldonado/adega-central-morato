/**
 * Separação entre o site dos clientes e o painel administrativo.
 *
 * Com ADMIN_HOST definido (ex.: "admin.seudominio.com.br"):
 *  - o painel e as rotas de login só respondem nesse endereço;
 *  - no endereço do cardápio, /admin, /api/admin e /api/auth respondem 404
 *    ("página não encontrada"), como se não existissem;
 *  - no endereço do painel, as páginas do cardápio também respondem 404.
 *
 * Sem ADMIN_HOST:
 *  - em desenvolvimento (npm run dev) o painel fica em /admin, para facilitar;
 *  - em produção o painel fica DESATIVADO (404), para que ele nunca fique
 *    exposto no mesmo endereço do cardápio por esquecimento.
 *
 * Este módulo não tem dependências: roda no middleware (Edge) e nos testes.
 */

export type HostDecision =
  | { action: "next"; adminHost: boolean }
  | { action: "not_found"; api: boolean }
  | { action: "redirect"; pathname: string };

const ADMIN_PREFIXES = ["/admin", "/api/admin", "/api/auth"];

/** Caminhos que pertencem ao painel administrativo. */
export function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Arquivos estáticos de /public (logo etc.) — servidos nos dois endereços. */
function isStaticAsset(pathname: string): boolean {
  return /^\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|avif|svg|ico|txt|webmanifest)$/.test(pathname);
}

/**
 * Normaliza um host: minúsculas, sem "https://", sem barra e sem ponto final.
 * Mantém a porta. Assim "https://Admin.Site.com.br/" vira "admin.site.com.br".
 */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

/** Valida o formato de ADMIN_HOST (só o host, com porta opcional). */
export function isValidAdminHost(value: string): boolean {
  return /^(?=.{1,253}(:\d{1,5})?$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(:\d{1,5})?$/.test(
    value,
  );
}

export function decideHost(input: {
  host: string | null | undefined;
  pathname: string;
  adminHost: string | null | undefined;
  isProduction: boolean;
}): HostDecision {
  const host = normalizeHost(input.host);
  const adminHost = normalizeHost(input.adminHost);
  const { pathname } = input;
  const adminPath = isAdminPath(pathname);
  const api = pathname.startsWith("/api/");

  if (!adminHost) {
    if (adminPath && input.isProduction) return { action: "not_found", api };
    return { action: "next", adminHost: false };
  }

  if (host === adminHost) {
    if (pathname === "/") return { action: "redirect", pathname: "/admin" };
    if (adminPath || pathname === "/api/health" || isStaticAsset(pathname)) {
      return { action: "next", adminHost: true };
    }
    return { action: "not_found", api };
  }

  if (adminPath) return { action: "not_found", api };
  return { action: "next", adminHost: false };
}
