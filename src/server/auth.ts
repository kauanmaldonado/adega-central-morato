import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSessionClient, type SessionClient } from "@/lib/supabase/server";
import { ApiError } from "./http";

export interface AdminContext {
  supabase: SessionClient;
  user: User;
}

/** Retorna o usuário logado E administrador (registrado em admin_users), ou null. */
export async function getAdmin(): Promise<AdminContext | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) return null;
  return { supabase, user };
}

/** Para rotas de API: lança 401/403 se não for administrador. */
export async function requireAdminApi(): Promise<AdminContext> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Faça login para continuar.");
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) throw new ApiError(403, "forbidden", "Acesso negado.");
  return { supabase, user };
}

/** Para páginas do painel: redireciona para o login se não for administrador. */
export async function requireAdminPage(): Promise<AdminContext> {
  const admin = await getAdmin();
  // Sem sessão ou sem permissão: volta para o login.
  if (!admin) redirect("/admin/login");
  return admin;
}
