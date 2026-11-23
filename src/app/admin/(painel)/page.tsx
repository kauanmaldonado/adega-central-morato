import Link from "next/link";
import { formatBRL } from "@/lib/money";
import { FULFILLMENT_LABELS } from "@/lib/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/server/auth";
import { dashboardStats } from "@/server/orders";
import { getSettings } from "@/server/settings";
import styles from "@/components/admin/admin.module.css";

export default async function DashboardPage() {
  const { supabase } = await requireAdminPage();
  const [stats, settings] = await Promise.all([dashboardStats(supabase), getSettings(supabase)]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Início</h1>

      {!settings.whatsapp_number && (
        <p className="alert alert-info">
          O número de WhatsApp da loja ainda não foi configurado. Sem ele, o cliente não consegue enviar o pedido pelo WhatsApp.{" "}
          <Link href="/admin/configuracoes">Configurar agora</Link>
        </p>
      )}
      {!settings.is_open && (
        <p className="alert alert-info">
          A loja está marcada como <strong>fechada</strong>: o cardápio aparece, mas não recebe pedidos.{" "}
          <Link href="/admin/configuracoes">Alterar</Link>
        </p>
      )}

      <div className={styles.stats}>
        <div className="card"><span className={styles.statValue}>{stats.ordersToday}</span><span className="muted">pedidos hoje</span></div>
        <div className="card"><span className={styles.statValue}>{formatBRL(stats.revenueTodayCents)}</span><span className="muted">em pedidos hoje</span></div>
        <div className="card"><span className={styles.statValue}>{stats.openOrders}</span><span className="muted">pedidos em aberto</span></div>
        <div className="card"><span className={styles.statValue}>{stats.activeProducts}</span><span className="muted">produtos ativos</span></div>
      </div>

      <section className="card">
        <div className={styles.cardHead}>
          <h2 className={styles.subtitle}>Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="btn btn-light btn-sm">Ver todos</Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="muted">Nenhum pedido ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr><th>Nº</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Status</th><th>Data</th></tr>
              </thead>
              <tbody>
                {stats.recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/pedidos/${o.id}`}><strong>#{o.code}</strong></Link></td>
                    <td>{o.customer_name}</td>
                    <td>{FULFILLMENT_LABELS[o.fulfillment]}</td>
                    <td>{formatBRL(o.total_cents)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
