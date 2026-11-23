import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { normalizeHost } from "@/lib/admin-host";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
  const adminHost = normalizeHost(process.env.ADMIN_HOST);
  if (adminHost && host === adminHost) return [];

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!site) return [];
  return [{ url: `${site}/`, changeFrequency: "daily", priority: 1 }];
}
