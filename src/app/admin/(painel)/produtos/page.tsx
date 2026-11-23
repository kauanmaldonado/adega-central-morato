import type { Metadata } from "next";
import Link from "next/link";
import { ProductList } from "@/components/admin/ProductList";
import { requireAdminPage } from "@/server/auth";
import { listCategories } from "@/server/categories";
import { listProducts } from "@/server/products";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const { supabase } = await requireAdminPage();
  const [products, categories] = await Promise.all([listProducts(supabase), listCategories(supabase)]);

  return (
    <div className={styles.page}>
      <div className={styles.cardHead}>
        <h1 className={styles.title}>Produtos</h1>
        {categories.length > 0 && <Link href="/admin/produtos/novo" className="btn btn-dark">+ Novo produto</Link>}
      </div>
      {categories.length === 0 ? (
        <p className="alert alert-info">
          Crie pelo menos uma categoria antes de cadastrar produtos. <Link href="/admin/categorias">Criar categoria</Link>
        </p>
      ) : (
        <ProductList products={products} categories={categories} />
      )}
    </div>
  );
}
