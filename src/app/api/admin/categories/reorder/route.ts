import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { categoryReorderSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { reorderCategories } from "@/server/categories";
import { assertSameOrigin, json, parseJson, route } from "@/server/http";

/** POST /api/admin/categories/reorder — { ids: [...] } na nova ordem. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const { ids } = await parseJson(req, categoryReorderSchema);
  await reorderCategories(supabase, ids);
  revalidateTag(CATALOG_TAG);
  return json({ ok: true });
});
