import "server-only";
import { slugify } from "@/lib/slug";
import type { Category, CategoryWithCount } from "@/lib/types";
import type { CategoryCreateInput, CategoryUpdateInput } from "@/lib/validation";
import type { SessionClient } from "@/lib/supabase/server";
import { ApiError, DbError, unwrap } from "./http";

export async function listCategories(sb: SessionClient): Promise<CategoryWithCount[]> {
  const rows = unwrap(
    await sb.from("categories").select("*, products(count)").order("position").order("name"),
  ) as Array<Category & { products: Array<{ count: number }> }>;
  return rows.map(({ products, ...c }) => ({ ...c, product_count: products[0]?.count ?? 0 }));
}

/** Gera um slug livre: "refrigerantes", "refrigerantes-2", ... */
async function freeSlug(sb: SessionClient, base: string, ignoreId?: string): Promise<string> {
  const rows = unwrap(
    await sb.from("categories").select("id, slug").like("slug", `${base}%`),
  ) as Array<{ id: string; slug: string }>;
  const taken = new Set(rows.filter((r) => r.id !== ignoreId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

export async function createCategory(sb: SessionClient, input: CategoryCreateInput): Promise<Category> {
  const slug = await freeSlug(sb, slugify(input.name));
  return unwrap(await sb.from("categories").insert({ ...input, slug }).select("*").single()) as Category;
}

export async function updateCategory(sb: SessionClient, id: string, input: CategoryUpdateInput): Promise<Category> {
  const patch: Record<string, unknown> = { ...input };
  if (input.name) patch.slug = await freeSlug(sb, slugify(input.name), id);
  const res = await sb.from("categories").update(patch).eq("id", id).select("*").maybeSingle();
  const row = unwrap(res) as Category | null;
  if (!row) throw new ApiError(404, "not_found", "Categoria não encontrada.");
  return row;
}

export async function deleteCategory(sb: SessionClient, id: string): Promise<void> {
  const res = await sb.from("categories").delete().eq("id", id).select("id");
  if (res.error?.code === "23503") {
    throw new ApiError(409, "category_in_use", "Esta categoria tem produtos. Mova ou exclua os produtos antes.");
  }
  if (res.error) throw new DbError(res.error);
  if (!res.data?.length) throw new ApiError(404, "not_found", "Categoria não encontrada.");
}

export async function reorderCategories(sb: SessionClient, ids: string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    unwrap(await sb.from("categories").update({ position }).eq("id", id).select("id"));
  }
}
