import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { productPatchSchema, productSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { deleteProduct, getProduct, patchProduct, saveProduct } from "@/server/products";
import { assertSameOrigin, json, parseJson, routeWithId } from "@/server/http";

export const GET = routeWithId(async (_req, id) => {
  const { supabase } = await requireAdminApi();
  return json({ product: await getProduct(supabase, id) });
});

/** PUT — substitui o produto inteiro (dados + opções). */
export const PUT = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const input = await parseJson(req, productSchema);
  const product = await saveProduct(supabase, input, id);
  revalidateTag(CATALOG_TAG);
  return json({ product });
});

/** PATCH — liga/desliga ativo, "mais pedido" e "novidade". */
export const PATCH = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  await patchProduct(supabase, id, await parseJson(req, productPatchSchema));
  revalidateTag(CATALOG_TAG);
  return json({ ok: true });
});

export const DELETE = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  await deleteProduct(supabase, id);
  revalidateTag(CATALOG_TAG);
  return json({ ok: true });
});
