"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import styles from "./admin.module.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "/";

const LINKS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <header className={styles.nav}>
      <div className={styles.navTop}>
        <Link href="/admin" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Adega Central Morato" width={96} height={44} style={{ width: 96, height: "auto" }} />
          <span>Painel</span>
        </Link>
        <div className={styles.navUser}>
          <span className={styles.navEmail} title={email}>{email}</span>
          <button type="button" className="btn btn-sm" style={{ background: "#222", color: "#fff" }} onClick={logout} disabled={leaving}>
            Sair
          </button>
        </div>
      </div>
      <nav aria-label="Painel" className={styles.navLinks}>
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? styles.navLinkOn : styles.navLink} aria-current={active ? "page" : undefined}>
              {l.label}
            </Link>
          );
        })}
        {/* O painel fica em outro endereço: o link aponta para o site dos clientes */}
        <a href={SITE_URL} className={styles.navLink} target="_blank" rel="noopener noreferrer">
          Ver cardápio ↗
        </a>
      </nav>
    </header>
  );
}
