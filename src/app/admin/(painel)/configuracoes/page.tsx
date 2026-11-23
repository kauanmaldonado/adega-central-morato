import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireAdminPage } from "@/server/auth";
import { getSettings } from "@/server/settings";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const settings = await getSettings(supabase);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Configurações da loja</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
