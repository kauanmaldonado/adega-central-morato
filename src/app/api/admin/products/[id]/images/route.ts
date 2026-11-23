import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { requireAdminApi } from "@/server/auth";
import { uploadProductImage } from "@/server/images";
import { ApiError, assertSameOrigin, json, routeWithId } from "@/server/http";

/** POST multipart/form-data: file (imagem), alt (opcional). */
export const POST = routeWithId(async (req, productId) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 6 * 1024 * 1024) throw new ApiError(413, "file_too_large", "A foto deve ter no máximo 5 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "invalid_form", "Envio inválido.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "file_required", "Escolha uma foto.");
  const altRaw = form.get("alt");
  const alt = typeof altRaw === "string" && altRaw.trim() ? altRaw.trim().slice(0, 160) : null;

  const image = await uploadProductImage(supabase, productId, file, alt);
  revalidateTag(CATALOG_TAG);
  return json({ image }, { status: 201 });
});
