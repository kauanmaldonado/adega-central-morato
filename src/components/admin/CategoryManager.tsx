"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CategoryWithCount } from "@/lib/types";
import { api, ApiClientError } from "./api";
import { Toggle } from "./ProductList";
import styles from "./admin.module.css";

export function CategoryManager({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setList(categories);
    setNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
  }, [categories]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiClientError ? e.message : "Não foi possível salvar." });
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setList(next);
    void run(() => api("/api/admin/categories/reorder", { method: "POST", body: { ids: next.map((c) => c.id) } }), "Ordem salva.");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`} role="status">{message.text}</p>}

      <form
        className="card"
        style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          void run(async () => {
            await api("/api/admin/categories", { method: "POST", body: { name: newName, position: list.length } });
            setNewName("");
          }, "Categoria criada.");
        }}
      >
        <label className="field" style={{ flex: 1 }}>
          <span>Nova categoria</span>
          <input className="input" value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Refrigerantes" />
        </label>
        <button type="submit" className="btn btn-dark" style={{ height: 48 }} disabled={busy || !newName.trim()}>Criar</button>
      </form>

      <section className="card">
        {list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nenhuma categoria ainda. Crie a primeira acima.</p>
        ) : (
          <ul className={styles.catList}>
            {list.map((c, i) => {
              const draft = names[c.id] ?? c.name;
              const changed = draft.trim() !== c.name;
              return (
                <li key={c.id} className={styles.catRow} style={{ opacity: c.is_active ? 1 : 0.6 }}>
                  <span className={styles.catNum}>{String(i + 1).padStart(2, "0")}</span>
                  <label className="field" style={{ flex: 1, minWidth: 160 }}>
                    <span className="sr-only">Nome da categoria</span>
                    <input className="input" value={draft} maxLength={60} onChange={(e) => setNames({ ...names, [c.id]: e.target.value })} />
                  </label>
                  {changed && (
                    <button type="button" className="btn btn-dark btn-sm" disabled={busy || !draft.trim()} onClick={() => run(() => api(`/api/admin/categories/${c.id}`, { method: "PATCH", body: { name: draft } }), "Nome salvo.")}>
                      Salvar
                    </button>
                  )}
                  <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{c.product_count} {c.product_count === 1 ? "produto" : "produtos"}</span>
                  <Toggle checked={c.is_active} label={`Categoria ${c.name} ativa`} disabled={busy} onChange={() => run(() => api(`/api/admin/categories/${c.id}`, { method: "PATCH", body: { is_active: !c.is_active } }), c.is_active ? "Categoria oculta do cardápio." : "Categoria visível no cardápio.")} />
                  <button type="button" className="btn btn-light btn-sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${c.name}`}>↑</button>
                  <button type="button" className="btn btn-light btn-sm" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${c.name}`}>↓</button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy || c.product_count > 0}
                    title={c.product_count > 0 ? "Mova ou exclua os produtos antes" : undefined}
                    onClick={() => run(() => api(`/api/admin/categories/${c.id}`, { method: "DELETE" }), "Categoria excluída.")}
                  >
                    Excluir
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>Categorias com produtos não podem ser excluídas. Para esconder do cardápio, desative.</p>
      </section>
    </div>
  );
}
