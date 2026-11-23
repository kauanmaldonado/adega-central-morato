"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { CategoryWithCount, Product } from "@/lib/types";
import { api, ApiClientError } from "./api";
import styles from "./admin.module.css";

interface VariantDraft {
  key: string;
  id: string | null;
  label: string;
  price: string;
  compareAt: string;
  is_active: boolean;
}

let seq = 0;
const newKey = () => `n${++seq}`;

export function ProductForm({ categories, product }: { categories: CategoryWithCount[]; product?: Product }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [badge, setBadge] = useState(product?.badge ?? "");
  const [position, setPosition] = useState(String(product?.position ?? 0));
  const [flags, setFlags] = useState({
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
    is_new: product?.is_new ?? false,
  });
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          key: v.id,
          id: v.id,
          label: v.label,
          price: centsToInput(v.price_cents),
          compareAt: centsToInput(v.compare_at_cents),
          is_active: v.is_active,
        }))
      : [{ key: newKey(), id: null, label: "", price: "", compareAt: "", is_active: true }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const move = (index: number, dir: -1 | 1) =>
    setVariants((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const local: Record<string, string> = {};
    const parsed = variants.map((v, i) => {
      const price = parseBRLToCents(v.price);
      const compare = v.compareAt.trim() ? parseBRLToCents(v.compareAt) : null;
      if (price === null) local[`variants.${i}.price_cents`] = "Preço inválido. Ex.: 12,90";
      if (v.compareAt.trim() && compare === null) local[`variants.${i}.compare_at_cents`] = "Valor inválido.";
      return { id: v.id, label: v.label, price_cents: price ?? 0, compare_at_cents: compare, is_active: v.is_active };
    });
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage({ ok: false, text: "Confira os campos destacados." });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const body = {
        category_id: categoryId,
        name,
        description,
        badge,
        position: Number.parseInt(position, 10) || 0,
        ...flags,
        variants: parsed,
      };
      if (product) {
        await api(`/api/admin/products/${product.id}`, { method: "PUT", body });
        setMessage({ ok: true, text: "Produto salvo." });
        router.refresh();
      } else {
        const res = await api<{ product: Product }>("/api/admin/products", { method: "POST", body });
        router.push(`/admin/produtos/${res.product.id}?criado=1`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fields);
        setMessage({ ok: false, text: err.message });
      } else {
        setMessage({ ok: false, text: "Não foi possível salvar." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!product) return;
    setDeleting(true);
    try {
      await api(`/api/admin/products/${product.id}`, { method: "DELETE" });
      router.push("/admin/produtos");
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiClientError ? err.message : "Não foi possível excluir." });
      setDeleting(false);
    }
  }

  const err = (k: string) => errors[k];

  return (
    <form className="card" onSubmit={save} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`} role="status">{message.text}</p>}

      <label className="field">
        <span>Nome</span>
        <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={!!err("name")} required />
        {err("name") && <span className="field-error">{err("name")}</span>}
      </label>

      <div className={styles.grid2}>
        <label className="field">
          <span>Categoria</span>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inativa)"}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Rótulo sem foto</span>
          <input className="input" value={badge} maxLength={20} onChange={(e) => setBadge(e.target.value)} placeholder="Ex.: 350ml" />
        </label>
      </div>

      <label className="field">
        <span>Descrição</span>
        <textarea className="textarea" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        {err("description") && <span className="field-error">{err("description")}</span>}
      </label>

      <fieldset className={styles.fieldset}>
        <legend className="label">Opções e preços</legend>
        <p className="hint" style={{ margin: 0 }}>
          Cada opção é um tamanho ou sabor com preço próprio. Para colocar em oferta, preencha o preço &quot;de&quot; (riscado), maior que o preço atual.
        </p>
        {err("variants") && <span className="field-error">{err("variants")}</span>}
        {variants.map((v, i) => (
          <div key={v.key} className={styles.variantRow}>
            <label className="field">
              <span>Opção</span>
              <input className="input" value={v.label} maxLength={60} placeholder="Ex.: Lata 350ml" onChange={(e) => setVariant(v.key, { label: e.target.value })} aria-invalid={!!err(`variants.${i}.label`)} />
              {err(`variants.${i}.label`) && <span className="field-error">{err(`variants.${i}.label`)}</span>}
            </label>
            <label className="field">
              <span>Preço (R$)</span>
              <input className="input" inputMode="decimal" value={v.price} placeholder="0,00" onChange={(e) => setVariant(v.key, { price: e.target.value })} aria-invalid={!!err(`variants.${i}.price_cents`)} />
              {err(`variants.${i}.price_cents`) && <span className="field-error">{err(`variants.${i}.price_cents`)}</span>}
            </label>
            <label className="field">
              <span>Preço &quot;de&quot;</span>
              <input className="input" inputMode="decimal" value={v.compareAt} placeholder="opcional" onChange={(e) => setVariant(v.key, { compareAt: e.target.value })} aria-invalid={!!err(`variants.${i}.compare_at_cents`)} />
              {err(`variants.${i}.compare_at_cents`) && <span className="field-error">{err(`variants.${i}.compare_at_cents`)}</span>}
            </label>
            <div className={styles.variantTools}>
              <label className="check" style={{ minHeight: 36 }}>
                <input type="checkbox" checked={v.is_active} onChange={(e) => setVariant(v.key, { is_active: e.target.checked })} /> À venda
              </label>
              <button type="button" className="btn btn-light btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir opção ${i + 1}`}>↑</button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => move(i, 1)} disabled={i === variants.length - 1} aria-label={`Descer opção ${i + 1}`}>↓</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setVariants((l) => l.filter((x) => x.key !== v.key))} disabled={variants.length === 1} aria-label={`Remover opção ${i + 1}`}>Remover</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-light btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setVariants((l) => [...l, { key: newKey(), id: null, label: "", price: "", compareAt: "", is_active: true }])}>
          + Adicionar opção
        </button>
      </fieldset>

      <div className={styles.grid2}>
        <label className="check"><input type="checkbox" checked={flags.is_active} onChange={(e) => setFlags({ ...flags, is_active: e.target.checked })} /> Ativo (aparece no cardápio)</label>
        <label className="check"><input type="checkbox" checked={flags.is_featured} onChange={(e) => setFlags({ ...flags, is_featured: e.target.checked })} /> Mais pedido</label>
        <label className="check"><input type="checkbox" checked={flags.is_new} onChange={(e) => setFlags({ ...flags, is_new: e.target.checked })} /> Novidade</label>
        <label className="field">
          <span>Ordem na categoria</span>
          <input className="input" type="number" min={0} max={10000} value={position} onChange={(e) => setPosition(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-dark" disabled={saving} style={{ flex: 1, height: 52 }}>
          {saving ? "Salvando…" : product ? "Salvar alterações" : "Criar produto"}
        </button>
        {product && !confirmDelete && (
          <button type="button" className="btn btn-danger" style={{ height: 52 }} onClick={() => setConfirmDelete(true)}>Excluir</button>
        )}
      </div>
      {product && confirmDelete && (
        <div className="alert alert-error" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span>Excluir &quot;{product.name}&quot; e suas fotos? Pedidos antigos continuam registrados. Para apenas esconder do cardápio, desmarque &quot;Ativo&quot;.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={deleting}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {!product && <p className="hint" style={{ margin: 0 }}>Depois de criar o produto você poderá enviar as fotos.</p>}
    </form>
  );
}
