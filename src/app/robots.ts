import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { normalizeHost } from "@/lib/admin-host";

/**
 * robots.txt
 * - No endereço do painel (ADMIN_HOST): bloqueia tudo.
 * - No cardápio: não menciona o painel (ele nem existe nesse endereço).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
  const adminHost = normalizeHost(process.env.ADMIN_HOST);
  if (adminHost && host === adminHost) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/checkout"] }],
    ...(site ? { sitemap: `${site.replace(/\/+$/, "")}/sitemap.xml`, host: site } : {}),
  };
}
