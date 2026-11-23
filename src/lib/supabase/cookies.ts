import type { CookieOptions } from "@supabase/ssr";

/** Mesma regra de hardenCookie, sem dependências de servidor (roda no Edge). */
export function hardenCookieEdge(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
