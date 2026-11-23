import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { hardenCookieEdge } from "@/lib/supabase/cookies";
import { decideHost } from "@/lib/admin-host";

/**
 * Middleware:
 * 1. Separa os endereços: o painel só existe em ADMIN_HOST e fica invisível
 *    (404) no endereço do cardápio. Regras em src/lib/admin-host.ts.
 * 2. Redireciona para o domínio oficial do cardápio (CANONICAL_HOST), se
 *    configurado — nunca o endereço do painel.
 * 3. Nas rotas do painel, renova a sessão do Supabase e manda para o login
 *    quem não estiver autenticado. A verificação de ADMINISTRADOR (incluindo
 *    o código de 6 dígitos) acontece no servidor (layout do painel e cada rota
 *    /api/admin) e no banco (RLS exige sessão aal2).
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const isProduction = process.env.NODE_ENV === "production";

  const decision = decideHost({
    host,
    pathname: request.nextUrl.pathname,
    adminHost: process.env.ADMIN_HOST,
    isProduction,
  });

  if (decision.action === "not_found") {
    if (decision.api) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Não encontrado." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    // Rota inexistente: o Next.js mostra a página "não encontrada" (404)
    return NextResponse.rewrite(new URL("/pagina-nao-encontrada", request.url), { status: 404 });
  }

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const canonical = process.env.CANONICAL_HOST;
  if (
    !decision.adminHost &&
    canonical &&
    host &&
    host !== canonical &&
    isProduction &&
    // Na Vercel, só redireciona em produção (não em previews). Em outras
    // hospedagens (ex.: Hostinger) VERCEL_ENV não existe e vale NODE_ENV.
    (process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === "production")
  ) {
    const url = request.nextUrl.clone();
    url.host = canonical;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdminArea) {
    const res = NextResponse.next();
    if (decision.adminHost) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  let response = NextResponse.next({ request });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  const supabase = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieEdge(options));
        }
      },
    },
  });

  // getUser() valida o token no servidor de autenticação (não confia só no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname === "/admin/login";
  if (!user && pathname.startsWith("/admin") && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Ignora arquivos estáticos e imagens otimizadas
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
