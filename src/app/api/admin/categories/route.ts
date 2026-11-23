import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { categoryCreateSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { createCategory, listCategories } from "@/server/categories";
import { assertSameOrigin, json, parseJson, route } from "@/server/http";

export const GET = route(async () => {
  const { supabase } = await requireAdminApi();
  return json({ categories: await listCategories(supabase) });
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const input = await parseJson(req, categoryCreateSchema);
  const category = await createCategory(supabase, input);
  revalidateTag(CATALOG_TAG);
  return json({ category }, { status: 201 });
});
