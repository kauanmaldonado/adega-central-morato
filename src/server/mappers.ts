import { publicImageUrl } from "@/lib/env";
import type { Product, ProductImage, StoreSettings, Variant } from "@/lib/types";

/* Linhas como vêm do PostgREST. Mantidas aqui para isolar o formato do banco. */
export interface ProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  badge: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  product_variants?: Variant[] | null;
  product_images?: Array<Omit<ProductImage, "url">> | null;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function toProduct(row: ProductRow): Product {
  const { product_variants, product_images, ...rest } = row;
  return {
    ...rest,
    variants: [...(product_variants ?? [])].sort(byPosition),
    images: [...(product_images ?? [])]
      .sort(byPosition)
      .map((img) => ({ ...img, url: publicImageUrl(img.storage_path) })),
  };
}

export const PRODUCT_SELECT = "*, product_variants(*), product_images(*)";

export const SETTINGS_SELECT =
  "store_name, whatsapp_number, is_open, opening_hours, address, delivery_info, min_order_cents, accepted_payment_methods, updated_at";

export type SettingsRow = StoreSettings;
