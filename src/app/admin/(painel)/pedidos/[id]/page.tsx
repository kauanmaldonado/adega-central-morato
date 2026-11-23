import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/money";
import { maskPhone, toWhatsAppNumber } from "@/lib/phone";
import { FULFILLMENT_LABELS, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";
import { OrderActions } from "@/components/admin/OrderActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/server/auth";
import { ApiError } from "@/server/http";
import { getOrder } from "@/server/orders";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const order = await getOrder(supabase, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const wa = whatsappLink(toWhatsAppNumber(order.customer_phone), `Olá, ${order.customer_name}! Sobre o seu pedido nº ${order.code}:`);

  return (
    <div className={styles.page}>
      <Link href="/admin/pedidos" className={styles.back}>← Pedidos</Link>
      <div className={styles.cardHead}>
        <h1 className={styles.title}>Pedido #{order.code}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className={styles.twoCol}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className={styles.subtitle}>Itens</h2>
          <table className="table">
            <thead><tr><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.product_name} <span className="muted">· {i.variant_label}</span></td>
                  <td>{i.quantity}</td>
                  <td>{formatBRL(i.unit_price_cents)}</td>
                  <td>{formatBRL(i.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className={styles.totals}>
            <dt>Subtotal</dt><dd>{formatBRL(order.subtotal_cents)}</dd>
            <dt>Entrega</dt>
            <dd>{order.fulfillment === "retirada" ? "Retirada" : order.delivery_fee_cents == null ? "A definir" : formatBRL(order.delivery_fee_cents)}</dd>
            <dt><strong>Total</strong></dt><dd><strong>{formatBRL(order.total_cents)}</strong></dd>
          </dl>
          {order.notes && <p className="alert alert-info"><strong>Observações:</strong> {order.notes}</p>}
          {order.cancel_reason && <p className="alert alert-error"><strong>Motivo do cancelamento:</strong> {order.cancel_reason}</p>}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 className={styles.subtitle}>Cliente</h2>
            <p style={{ margin: 0 }}><strong>{order.customer_name}</strong></p>
            <p style={{ margin: 0 }}>{maskPhone(order.customer_phone)}</p>
            {wa && <a className="btn btn-light btn-sm" href={wa} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>Conversar no WhatsApp</a>}
            <h2 className={styles.subtitle} style={{ marginTop: 10 }}>{FULFILLMENT_LABELS[order.fulfillment]}</h2>
            {order.fulfillment === "entrega" ? (
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                {order.address_street}, {order.address_number}<br />
                {order.address_district}
                {order.address_complement && <><br />{order.address_complement}</>}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Cliente retira no balcão.</p>
            )}
            <h2 className={styles.subtitle} style={{ marginTop: 10 }}>Pagamento</h2>
            <p style={{ margin: 0 }}>{PAYMENT_LABELS[order.payment_method]}</p>
          </section>

          <OrderActions order={order} />

          <section className="card">
            <h2 className={styles.subtitle}>Histórico</h2>
            <ol className={styles.timeline}>
              {order.events.map((e) => (
                <li key={e.id}><span>{STATUS_LABELS[e.status]}</span><span className="muted">{formatDateTime(e.created_at)}</span></li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
