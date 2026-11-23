import type { Metadata } from "next";
import Link from "next/link";
import { formatBRL } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { FULFILLMENT_LABELS, ORDER_STATUSES, STATUS_LABELS } from "@/lib/types";
import { orderListQuerySchema } from "@/lib/validation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/server/auth";
import { listOrders } from "@/server/orders";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Pedidos" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const parsed = orderListQuerySchema.safeParse({ status: sp.status || undefined, q: sp.q || undefined, page: sp.page });
  const query = parsed.success ? parsed.data : { page: 1 };
  const { orders, total, page, pageSize } = await listOrders(supabase, query);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const link = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: query.status, q: query.q, page: undefined as number | undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") p.set(k, String(v));
    const s = p.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Pedidos</h1>

      <form className={styles.filters} action="/admin/pedidos">
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Buscar</span>
          <input className="input" name="q" defaultValue={query.q ?? ""} placeholder="Nº do pedido, telefone ou nome" />
        </label>
        <label className="field">
          <span>Status</span>
          <select className="select" name="status" defaultValue={query.status ?? ""}>
            <option value="">Todos</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-dark" style={{ alignSelf: "flex-end", height: 48 }}>Filtrar</button>
      </form>

      <section className="card">
        {orders.length === 0 ? (
          <p className="muted">Nenhum pedido encontrado.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr><th>Nº</th><th>Cliente</th><th>Telefone</th><th>Tipo</th><th>Total</th><th>Status</th><th>Data</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/pedidos/${o.id}`}><strong>#{o.code}</strong></Link></td>
                    <td>{o.customer_name}</td>
                    <td>{maskPhone(o.customer_phone)}</td>
                    <td>{FULFILLMENT_LABELS[o.fulfillment]}</td>
                    <td>{formatBRL(o.total_cents)}{o.fulfillment === "entrega" && o.delivery_fee_cents == null ? " + entrega" : ""}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pages > 1 && (
        <nav className={styles.pager} aria-label="Paginação">
          {page > 1 ? <Link className="btn btn-light btn-sm" href={link({ page: page - 1 })}>← Anterior</Link> : <span />}
          <span className="muted">Página {page} de {pages} · {total} pedidos</span>
          {page < pages ? <Link className="btn btn-light btn-sm" href={link({ page: page + 1 })}>Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
