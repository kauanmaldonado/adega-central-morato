"use client";

import type { ApiErrorBody } from "@/lib/types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/**
 * Chamada à API do backend a partir do painel. O cookie de sessão (httpOnly)
 * vai automaticamente; o backend confere se o usuário é administrador.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiClientError("Sem conexão com o servidor. Tente novamente.", 0);
  }
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const err = data && typeof data === "object" && "error" in data ? (data as ApiErrorBody).error : null;
    if (res.status === 401) {
      window.location.href = "/admin/login";
    }
    throw new ApiClientError(err?.message ?? "Erro inesperado.", res.status, err?.fields ?? {});
  }
  return data as T;
}
