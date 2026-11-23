import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageManager } from "@/components/admin/ImageManager";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/server/auth";
import { listCategories } from "@/server/categories";
import { ApiError } from "@/server/http";
import { getProduct } from "@/server/products";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [product, categories] = await Promise.all([
    getProduct(supabase, id).catch((e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    listCategories(supabase),
  ]);

  return (
    <div className={styles.page}>
      <Link href="/admin/produtos" className={styles.back}>← Produtos</Link>
      <h1 className={styles.title}>{product.name}</h1>
      <div className={styles.twoCol}>
        <ProductForm categories={categories} product={product} />
        <ImageManager productId={product.id} productName={product.name} images={product.images} />
      </div>
    </div>
  );
}
