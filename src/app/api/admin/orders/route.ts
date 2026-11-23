import { orderListQuerySchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { listOrders } from "@/server/orders";
import { json, route } from "@/server/http";

/** GET /api/admin/orders?status=novo&q=...&page=1 */
export const GET = route(async (req) => {
  const { supabase } = await requireAdminApi();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = orderListQuerySchema.parse({ ...params, status: params.status || undefined, q: params.q || undefined });
  return json(await listOrders(supabase, query));
});
