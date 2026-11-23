import { formatBRL } from "./money";
import { maskPhone } from "./phone";
import { FULFILLMENT_LABELS, PAYMENT_LABELS, type Fulfillment, type PaymentMethod } from "./types";

export interface WhatsAppOrder {
  code: number;
  storeName: string;
  customerName: string;
  customerPhone: string;
  fulfillment: Fulfillment;
  paymentMethod: PaymentMethod;
  address?: { street?: string | null; number?: string | null; district?: string | null; complement?: string | null } | null;
  notes?: string | null;
  items: Array<{ quantity: number; productName: string; variantLabel: string; lineTotalCents: number }>;
  subtotalCents: number;
}

/** Monta a mensagem do pedido a partir dos dados SALVOS no banco. */
export function buildOrderMessage(o: WhatsAppOrder): string {
  const lines: string[] = [];
  lines.push(`*Pedido nº ${o.code} · ${o.storeName}*`, "", "*Itens*");
  for (const i of o.items) {
    lines.push(`${i.quantity}x ${i.productName} (${i.variantLabel}) — ${formatBRL(i.lineTotalCents)}`);
  }
  lines.push("", `Subtotal: ${formatBRL(o.subtotalCents)}`);
  if (o.fulfillment === "entrega") {
    lines.push("Entrega: taxa a combinar", `*Total: ${formatBRL(o.subtotalCents)} + entrega*`);
  } else {
    lines.push("Retirada na adega: sem taxa", `*Total: ${formatBRL(o.subtotalCents)}*`);
  }
  lines.push("", "*Cliente*", `Nome: ${o.customerName}`, `Telefone: ${maskPhone(o.customerPhone)}`, "");
  if (o.fulfillment === "entrega" && o.address) {
    lines.push("*Entrega*", `${o.address.street ?? ""}, ${o.address.number ?? ""}`, `Bairro: ${o.address.district ?? ""}`);
    if (o.address.complement) lines.push(`Complemento: ${o.address.complement}`);
  } else {
    lines.push(`*${FULFILLMENT_LABELS.retirada}*`);
  }
  lines.push("", `*Pagamento:* ${PAYMENT_LABELS[o.paymentMethod]}`);
  if (o.notes) lines.push("", `*Observações:* ${o.notes}`);
  return lines.join("\n");
}

/** Link wa.me. `number` já com DDI (ex.: 5511999999999). */
export function whatsappLink(number: string | null, text?: string): string | null {
  if (!number || !/^55\d{10,11}$/.test(number)) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
