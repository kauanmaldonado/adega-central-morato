import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type { Catalog, Category, StoreSettings } from "@/lib/types";
import { unwrap } from "./http";
import { PRODUCT_SELECT, SETTINGS_SELECT, toProduct, type ProductRow } from "./mappers";

/**
 * Cardápio público. Usa o cliente anônimo: as políticas RLS garantem que só
 * categorias, produtos e opções ATIVOS sejam retornados.
 */
export async function getCatalog(): Promise<Catalog> {
  const sb = createPublicClient();
  const [settings, categories, products] = await Promise.all([
    sb.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).single(),
    sb.from("categories").select("*").order("position").order("name"),
    sb.from("products").select(PRODUCT_SELECT).order("position").order("name"),
  ]);

  const settingsData = unwrap(settings) as StoreSettings;
  const categoryRows = unwrap(categories) as Category[];
  const productList = (unwrap(products) as ProductRow[])
    .map(toProduct)
    .filter((p) => p.variants.length > 0); // sem opção à venda, não aparece

  return {
    settings: settingsData,
    categories: categoryRows
      .map((c) => ({ ...c, products: productList.filter((p) => p.category_id === c.id) }))
      .filter((c) => c.products.length > 0),
  };
}

/** Tag de cache do cardápio. As rotas do painel chamam revalidateTag(CATALOG_TAG). */
export const CATALOG_TAG = "catalog";

/** Cardápio com cache de 60 s, invalidado na hora quando o painel altera algo. */
export const getCatalogCached = unstable_cache(getCatalog, ["catalog-v1"], {
  revalidate: 60,
  tags: [CATALOG_TAG],
});
