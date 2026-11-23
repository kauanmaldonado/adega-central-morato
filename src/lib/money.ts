/** Utilitários de dinheiro. Todos os valores do sistema são inteiros em centavos. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 1290 → "R$ 12,90" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/**
 * Converte o que o administrador digita em centavos.
 * Aceita "12,90", "12.90", "1.234,56", "R$ 12,90", "12".
 * Retorna null se não for um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  const raw = input.replace(/R\$\s?/i, "").replace(/\s/g, "").trim();
  if (!raw) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(raw)) return null;

  let normalized: string;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, ""); // "1.234" → milhar
  } else {
    normalized = raw;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** 1290 → "12,90" (para preencher campos de formulário) */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Percentual de desconto inteiro entre preço "de" e "por". */
export function discountPercent(priceCents: number, compareAtCents: number | null): number | null {
  if (!compareAtCents || compareAtCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}
