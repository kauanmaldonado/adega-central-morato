import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { requireAdminPage } from "@/server/auth";
import { listCategories } from "@/server/categories";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdminPage();
  const categories = await listCategories(supabase);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Categorias</h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
