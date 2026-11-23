import { requireAdminApi } from "@/server/auth";
import { json, route } from "@/server/http";

/** GET /api/admin/me — dados do administrador logado. */
export const GET = route(async () => {
  const { user } = await requireAdminApi();
  return json({ id: user.id, email: user.email });
});
