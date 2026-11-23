import { Storefront } from "@/components/store/Storefront";
import { getCatalogCached } from "@/server/catalog";

// Renderizada a cada acesso; os dados vêm do cache do cardápio (60 s,
// invalidado na hora pelas alterações feitas no painel).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getCatalogCached();
  return <Storefront catalog={catalog} />;
}
