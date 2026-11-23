"use client";

import { useCallback, useEffect, useState } from "react";
import type { Catalog, Product, Variant } from "@/lib/types";

/**
 * Carrinho guardado no navegador (conveniência do visitante). Ele guarda só
 * ids e quantidades; nomes e preços vêm sempre do cardápio atual e, no envio,
 * o banco recalcula tudo.
 */
export interface CartEntry {
  variantId: string;
  qty: number;
}

const KEY = "acm_cart_v2";

function read(): CartEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is CartEntry => !!e && typeof e.variantId === "string" && Number.isInteger(e.qty))
      .map((e) => ({ variantId: e.variantId, qty: Math.min(99, Math.max(1, e.qty)) }));
  } catch {
    return [];
  }
}

function write(entries: CartEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* navegação privada / armazenamento cheio: o carrinho só não persiste */
  }
}

export function useCart() {
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setEntries(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (prev: CartEntry[]) => CartEntry[]) => {
    setEntries((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const add = useCallback(
    (variantId: string, qty: number) =>
      update((prev) => {
        const found = prev.find((e) => e.variantId === variantId);
        if (found) return prev.map((e) => (e.variantId === variantId ? { ...e, qty: Math.min(99, e.qty + qty) } : e));
        return [...prev, { variantId, qty: Math.min(99, qty) }];
      }),
    [update],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) =>
      update((prev) =>
        qty <= 0 ? prev.filter((e) => e.variantId !== variantId) : prev.map((e) => (e.variantId === variantId ? { ...e, qty: Math.min(99, qty) } : e)),
      ),
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  return { entries, ready, add, setQty, clear };
}

export interface CartLine {
  variant: Variant;
  product: Product;
  qty: number;
  totalCents: number;
}

/** Junta o carrinho com o cardápio atual; itens que saíram do cardápio são ignorados. */
export function resolveCart(catalog: Catalog, entries: CartEntry[]): CartLine[] {
  const index = new Map<string, { variant: Variant; product: Product }>();
  for (const c of catalog.categories)
    for (const p of c.products) for (const v of p.variants) index.set(v.id, { variant: v, product: p });
  return entries.flatMap((e) => {
    const hit = index.get(e.variantId);
    return hit ? [{ ...hit, qty: e.qty, totalCents: hit.variant.price_cents * e.qty }] : [];
  });
}
