import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/server/auth";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <main className={styles.loginShell}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt="Adega Central Morato" width={150} height={68} style={{ width: 150, height: "auto" }} />
        <h1 className="serif" style={{ fontSize: 30, margin: 0, fontWeight: 400 }}>Área administrativa</h1>
        <LoginForm />
      </div>
    </main>
  );
}
