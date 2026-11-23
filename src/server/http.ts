import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { fieldErrors } from "@/lib/validation";
import type { ApiErrorBody } from "@/lib/types";
import { mapDbError } from "./db-errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Erro vindo do Supabase (PostgREST / Storage). */
export class DbError extends Error {
  constructor(public readonly original: { code?: string | null; message?: string | null; details?: string | null }) {
    super(original.message ?? "db error");
  }
}

/** Lança DbError se a resposta do Supabase tiver erro; senão devolve os dados. */
export function unwrap<T>(res: { data: T; error: { code?: string; message: string; details?: string } | null }): T {
  if (res.error) throw new DbError(res.error);
  return res.data;
}

export function json<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

function errorJson(status: number, code: string, message: string, fields?: Record<string, string>) {
  const body: ApiErrorBody = { error: { code, message, ...(fields ? { fields } : {}) } };
  return json(body, { status });
}

export function toErrorResponse(e: unknown) {
  if (e instanceof ApiError) return errorJson(e.status, e.code, e.message, e.fields);
  if (e instanceof ZodError) {
    const fields = fieldErrors(e);
    return errorJson(422, "validation_error", Object.values(fields)[0] ?? "Dados inválidos.", fields);
  }
  if (e instanceof DbError) {
    const mapped = mapDbError(e.original);
    if (mapped.status >= 500) console.error("[db]", e.original);
    return errorJson(mapped.status, mapped.code, mapped.message);
  }
  console.error("[api]", e);
  return errorJson(500, "internal_error", "Erro interno. Tente novamente.");
}

/** Envolve um handler de rota com tratamento de erro padronizado. */
export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

type IdContext = { params: Promise<{ id: string }> };

/** Igual a route(), para rotas com [id]: valida o id como UUID antes de chamar o handler. */
export function routeWithId(handler: (req: Request, id: string) => Promise<Response>) {
  return async (req: Request, ctx: IdContext): Promise<Response> => {
    try {
      const { id } = await ctx.params;
      if (!UUID_RE.test(id)) throw new ApiError(404, "not_found", "Registro não encontrado.");
      return await handler(req, id);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

/** Lê e valida o corpo JSON, com limite de tamanho. */
export async function parseJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>, maxBytes = 64 * 1024): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Envie os dados em JSON.");
  }
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new ApiError(413, "payload_too_large", "Requisição muito grande.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", "Requisição muito grande.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "JSON inválido.");
  }
  return schema.parse(raw);
}

/**
 * Proteção contra CSRF nas rotas que alteram dados com sessão: a requisição
 * precisa vir do próprio site (cabeçalho Origin igual ao host).
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new ApiError(403, "invalid_origin", "Origem da requisição não permitida.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "invalid_origin", "Origem da requisição não permitida.");
  }
  if (originHost !== host) throw new ApiError(403, "invalid_origin", "Origem da requisição não permitida.");
}
