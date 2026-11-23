import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { categoryUpdateSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { deleteCategory, updateCategory } from "@/server/categories";
import { assertSameOrigin, json, parseJson, routeWithId } from "@/server/http";

export const PATCH = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const input = await parseJson(req, categoryUpdateSchema);
  const category = await updateCategory(supabase, id, input);
  revalidateTag(CATALOG_TAG);
  return json({ category });
});

export const DELETE = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  await deleteCategory(supabase, id);
  revalidateTag(CATALOG_TAG);
  return json({ ok: true });
});
