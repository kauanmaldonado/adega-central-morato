"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatBRL } from "@/lib/money";
import type { CategoryWithCount, Product } from "@/lib/types";
import { api, ApiClientError } from "./api";
import styles from "./admin.module.css";

type Flag = "is_active" | "is_featured" | "is_new";

export function ProductList({ products, categories }: { products: Product[]; categories: CategoryWithCount[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = products.filter((p) => (!cat || p.category_id === cat) && (!filter || norm(p.name).includes(norm(filter))));

  async function toggle(p: Product, flag: Flag) {
    setBusy(`${p.id}:${flag}`);
    setError(null);
    try {
      await api(`/api/admin/products/${p.id}`, { method: "PATCH", body: { [flag]: !p[flag] } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={styles.filters}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Buscar</span>
          <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nome do produto" />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <section className="card">
        {shown.length === 0 ? (
          <p className="muted">{products.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado."}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Ativo</th><th>Mais pedido</th><th>Novidade</th></tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const prices = p.variants.map((v) => v.price_cents);
                  const offer = p.variants.some((v) => v.compare_at_cents);
                  return (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                      <td>
                        <Link href={`/admin/produtos/${p.id}`} className={styles.productCell}>
                          <span className={styles.miniThumb}>
                            {p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.images[0].url} alt="" width={44} height={44} />
                            ) : (
                              <span aria-hidden="true">{p.badge ?? ""}</span>
                            )}
                          </span>
                          <span>
                            <strong>{p.name}</strong>
                            <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                              {p.variants.length} {p.variants.length === 1 ? "opção" : "opções"}{offer ? " · em oferta" : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>{catName.get(p.category_id) ?? "—"}</td>
                      <td>{prices.length ? formatBRL(Math.min(...prices)) : "—"}</td>
                      {(["is_active", "is_featured", "is_new"] as const).map((f) => (
                        <td key={f}>
                          <Toggle
                            checked={p[f]}
                            disabled={busy === `${p.id}:${f}`}
                            label={`${f === "is_active" ? "Ativo" : f === "is_featured" ? "Mais pedido" : "Novidade"}: ${p.name}`}
                            onChange={() => toggle(p, f)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? styles.switchOn : styles.switch} onClick={onChange} disabled={disabled}>
      <span />
    </button>
  );
}
