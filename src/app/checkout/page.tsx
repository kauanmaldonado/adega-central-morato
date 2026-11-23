import type { Metadata } from "next";
import { Checkout } from "@/components/store/Checkout";
import { getCatalogCached } from "@/server/catalog";

// Renderizada a cada acesso; os dados vêm do cache do cardápio (60 s,
// invalidado na hora pelas alterações feitas no painel).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finalizar pedido", robots: { index: false } };

export default async function CheckoutPage() {
  const catalog = await getCatalogCached();
  return <Checkout catalog={catalog} />;
}
