import "server-only";
import { publicImageUrl } from "@/lib/env";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, detectImageType } from "@/lib/validation";
import type { ProductImage } from "@/lib/types";
import type { SessionClient } from "@/lib/supabase/server";
import { ApiError, DbError, unwrap } from "./http";

export const BUCKET = "product-images";

type ImageRow = Omit<ProductImage, "url">;
const withUrl = (row: ImageRow): ProductImage => ({ ...row, url: publicImageUrl(row.storage_path) });

/**
 * Envia uma foto para o Storage e registra no banco.
 * A permissão de envio é verificada pelo Storage (política: só admins).
 */
export async function uploadProductImage(
  sb: SessionClient,
  productId: string,
  file: File,
  alt: string | null,
): Promise<ProductImage> {
  if (file.size === 0) throw new ApiError(422, "empty_file", "Arquivo vazio.");
  if (file.size > IMAGE_MAX_BYTES) throw new ApiError(413, "file_too_large", "A foto deve ter no máximo 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageType(bytes);
  if (!mime) throw new ApiError(415, "invalid_image", "Envie uma imagem JPG, PNG ou WebP.");

  const exists = unwrap(await sb.from("products").select("id").eq("id", productId).maybeSingle());
  if (!exists) throw new ApiError(404, "not_found", "Produto não encontrado.");

  const path = `products/${productId}/${crypto.randomUUID()}.${IMAGE_TYPES[mime]}`;
  const up = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) {
    console.error("[storage] upload", up.error);
    throw new ApiError(502, "upload_failed", "Não foi possível enviar a foto. Tente novamente.");
  }

  const last = unwrap(
    await sb.from("product_images").select("position").eq("product_id", productId)
      .order("position", { ascending: false }).limit(1),
  ) as Array<{ position: number }>;

  const res = await sb
    .from("product_images")
    .insert({ product_id: productId, storage_path: path, alt, position: (last[0]?.position ?? -1) + 1 })
    .select("*")
    .single();
  if (res.error) {
    await removeStorageFiles(sb, [path]);
    throw new DbError(res.error);
  }
  return withUrl(res.data as ImageRow);
}

export async function updateProductImage(
  sb: SessionClient,
  id: string,
  patch: { alt?: string | null; position?: number },
): Promise<ProductImage> {
  const row = unwrap(await sb.from("product_images").update(patch).eq("id", id).select("*").maybeSingle()) as ImageRow | null;
  if (!row) throw new ApiError(404, "not_found", "Foto não encontrada.");
  return withUrl(row);
}

export async function deleteProductImage(sb: SessionClient, id: string): Promise<void> {
  const rows = unwrap(
    await sb.from("product_images").delete().eq("id", id).select("storage_path"),
  ) as Array<{ storage_path: string }>;
  if (!rows.length) throw new ApiError(404, "not_found", "Foto não encontrada.");
  await removeStorageFiles(sb, rows.map((r) => r.storage_path));
}

/** Remove arquivos do Storage; falhas são registradas mas não interrompem. */
export async function removeStorageFiles(sb: SessionClient, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await sb.storage.from(BUCKET).remove(paths);
  if (error) console.error("[storage] remove", paths, error);
}
