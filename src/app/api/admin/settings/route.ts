import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/server/catalog";
import { settingsSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { getSettings, updateSettings } from "@/server/settings";
import { assertSameOrigin, json, parseJson, route } from "@/server/http";

export const GET = route(async () => {
  const { supabase } = await requireAdminApi();
  return json({ settings: await getSettings(supabase) });
});

export const PUT = route(async (req) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  const settings = await updateSettings(supabase, await parseJson(req, settingsSchema));
  revalidateTag(CATALOG_TAG);
  return json({ settings });
});
