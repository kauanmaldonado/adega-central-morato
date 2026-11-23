import "server-only";
import { slugify } from "@/lib/slug";
import type { Product } from "@/lib/types";
import type { ProductInput } from "@/lib/validation";
import type { SessionClient } from "@/lib/supabase/server";
import { ApiError, unwrap } from "./http";
import { PRODUCT_SELECT, toProduct, type ProductRow } from "./mappers";
import { removeStorageFiles } from "./images";

export async function listProducts(sb: SessionClient): Promise<Product[]> {
  const rows = unwrap(
    await sb.from("products").select(PRODUCT_SELECT).order("position").order("name"),
  ) as ProductRow[];
  return rows.map(toProduct);
}

export async function getProduct(sb: SessionClient, id: string): Promise<Product> {
  const row = unwrap(await sb.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle()) as ProductRow | null;
  if (!row) throw new ApiError(404, "not_found", "Produto não encontrado.");
  return toProduct(row);
}

/** Cria (id ausente) ou atualiza um produto com suas opções, numa transação no banco. */
export async function saveProduct(sb: SessionClient, input: ProductInput, id?: string): Promise<Product> {
  const payload = {
    ...input,
    id: id ?? null,
    slug: slugify(input.name),
    variants: input.variants.map((v, i) => ({ ...v, id: v.id ?? null, position: i })),
  };
  const savedId = unwrap(await sb.rpc("admin_save_product", { payload })) as string;
  return getProduct(sb, savedId);
}

export async function patchProduct(
  sb: SessionClient,
  id: string,
  patch: { is_active?: boolean; is_featured?: boolean; is_new?: boolean },
): Promise<void> {
  const rows = unwrap(await sb.from("products").update(patch).eq("id", id).select("id")) as Array<{ id: string }>;
  if (!rows.length) throw new ApiError(404, "not_found", "Produto não encontrado.");
}

/**
 * Exclui o produto (opções e registros de imagem vão junto, em cascata).
 * Pedidos antigos continuam com nome e preço copiados no momento da compra.
 */
export async function deleteProduct(sb: SessionClient, id: string): Promise<void> {
  const images = unwrap(
    await sb.from("product_images").select("storage_path").eq("product_id", id),
  ) as Array<{ storage_path: string }>;
  const deleted = unwrap(await sb.from("products").delete().eq("id", id).select("id")) as Array<{ id: string }>;
  if (!deleted.length) throw new ApiError(404, "not_found", "Produto não encontrado.");
  await removeStorageFiles(sb, images.map((i) => i.storage_path));
}
