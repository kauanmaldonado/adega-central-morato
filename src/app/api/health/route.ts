import { createPublicClient } from "@/lib/supabase/server";
import { json, route } from "@/server/http";

/**
 * GET /api/health — confirma que o app está no ar e conversa com o banco.
 * Útil depois do deploy e para monitoramento (UptimeRobot, Better Stack…).
 */
export const GET = route(async () => {
  const started = Date.now();
  const { error } = await createPublicClient().from("store_settings").select("is_open").eq("id", 1).single();
  if (error) return json({ ok: false, database: "error" }, { status: 503 });
  return json({ ok: true, database: "ok", latency_ms: Date.now() - started });
});
