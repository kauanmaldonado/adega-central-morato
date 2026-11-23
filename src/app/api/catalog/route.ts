import { getCatalogCached } from "@/server/catalog";
import { json, route } from "@/server/http";

/** GET /api/catalog — cardápio público (categorias, produtos, opções, fotos e dados da loja). */
export const GET = route(async () => {
  const catalog = await getCatalogCached();
  return json(catalog, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
