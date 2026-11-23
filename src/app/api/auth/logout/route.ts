import { createSessionClient } from "@/lib/supabase/server";
import { assertSameOrigin, json, route } from "@/server/http";

/** POST /api/auth/logout — encerra a sessão. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return json({ ok: true });
});
