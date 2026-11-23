import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { productSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { listProducts, saveProduct } from "@/server/products";
import { assertSameOrigin, json, parseJson, route } from "@/server/http";

export const GET = route(async () => {
  const { supabase } = await requireAdminApi();
  return json({ products: await listProducts(supabase) });
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const input = await parseJson(req, productSchema);
  const product = await saveProduct(supabase, input);
  revalidateTag(CATALOG_TAG);
  return json({ product }, { status: 201 });
});
