import { orderUpdateSchema } from "@/lib/validation";
import { requireAdminApi } from "@/server/auth";
import { getOrder, updateOrder } from "@/server/orders";
import { assertSameOrigin, json, parseJson, routeWithId } from "@/server/http";

export const GET = routeWithId(async (_req, id) => {
  const { supabase } = await requireAdminApi();
  return json({ order: await getOrder(supabase, id) });
});

/** PATCH — status, taxa de entrega e motivo de cancelamento. */
export const PATCH = routeWithId(async (req, id) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminApi();
  return json({ order: await updateOrder(supabase, id, await parseJson(req, orderUpdateSchema)) });
});
