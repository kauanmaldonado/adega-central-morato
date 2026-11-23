import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/server/auth";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel · Adega Central Morato" },
  robots: { index: false, follow: false },
};

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdminPage();
  return (
    <div className={styles.layout}>
      <AdminNav email={user.email ?? ""} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
