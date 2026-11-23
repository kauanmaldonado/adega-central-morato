import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/server/auth";
import { listCategories } from "@/server/categories";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const { supabase } = await requireAdminPage();
  const categories = await listCategories(supabase);
  if (categories.length === 0) redirect("/admin/categorias");
  return (
    <div className={styles.page}>
      <Link href="/admin/produtos" className={styles.back}>← Produtos</Link>
      <h1 className={styles.title}>Novo produto</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
