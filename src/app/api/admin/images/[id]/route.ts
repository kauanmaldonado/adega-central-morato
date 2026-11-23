import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { imageUpdateSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { deleteProductImage, updateProductImage } from "@/server/images";
import { assertSameOrigin, json, parseJson, routeWithId } from "@/server/http";

export const PATCH = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const image = await updateProductImage(supabase, id, await parseJson(req, imageUpdateSchema));
  revalidateTag(CATALOG_TAG);
  return json({ image });
});

export const DELETE = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  await deleteProductImage(supabase, id);
  revalidateTag(CATALOG_TAG);
  return json({ ok: true });
});
