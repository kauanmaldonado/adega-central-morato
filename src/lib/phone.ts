/** Telefones brasileiros: guardados só com dígitos (DDD + número, sem DDI). */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Remove DDI 55 se vier junto e devolve só DDD + número. */
export function normalizePhone(value: string): string {
  let d = onlyDigits(value);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
}

export function isValidPhone(value: string): boolean {
  return /^\d{10,11}$/.test(normalizePhone(value));
}

/** Máscara progressiva para o campo de telefone: (11) 98888-7777 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Número para o link wa.me: sempre com DDI 55. Retorna null se inválido. */
export function toWhatsAppNumber(value: string): string | null {
  const d = normalizePhone(value);
  return /^\d{10,11}$/.test(d) ? `55${d}` : null;
}
