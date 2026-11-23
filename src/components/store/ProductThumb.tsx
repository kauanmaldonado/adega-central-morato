import Image from "next/image";
import type { Product } from "@/lib/types";
import styles from "./store.module.css";

/** Foto principal do produto ou, sem foto, o rótulo curto (ex.: "350ml"). */
export function ProductThumb({
  product,
  sizes,
  badgeSize = 22,
  priority = false,
}: {
  product: Product;
  sizes: string;
  badgeSize?: number;
  priority?: boolean;
}) {
  const img = product.images[0];
  return (
    <div className={styles.thumb}>
      {img ? (
        <Image
          src={img.url}
          alt={img.alt || product.name}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <span className={styles.thumbBadge} style={{ fontSize: badgeSize }} aria-hidden="true">
          {product.badge || product.name.slice(0, 2)}
        </span>
      )}
    </div>
  );
}
