import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { hardenCookieEdge } from "./cookies";

/**
 * O navegador nunca fala direto com o Supabase neste projeto (tudo passa pela
 * API do Next.js), então os cookies de sessão podem ser httpOnly.
 */
const hardenCookie = hardenCookieEdge;

/** Cliente com a sessão do usuário (cookies). Sujeito às políticas RLS. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookie(options));
          }
        } catch {
          // Chamado a partir de um Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}

/** Cliente anônimo, sem sessão — usado para o cardápio público (cacheável). */
export function createPublicClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type SessionClient = Awaited<ReturnType<typeof createSessionClient>>;
