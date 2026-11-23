import "server-only";
import type { Order, OrderStatus, OrderSummary } from "@/lib/types";
import type { OrderCreateInput, OrderUpdateInput } from "@/lib/validation";
import { createPublicClient, type SessionClient } from "@/lib/supabase/server";
import { ApiError, unwrap } from "./http";

export const ORDERS_PAGE_SIZE = 20;

const SUMMARY_SELECT =
  "id, code, status, fulfillment, payment_method, customer_name, customer_phone, subtotal_cents, delivery_fee_cents, total_cents, created_at";

export interface CreatedOrder {
  id: string;
  code: number;
  subtotal_cents: number;
  items: Array<{
    product_name: string;
    variant_label: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
}

/**
 * Cria o pedido pela função create_order do banco, que recalcula preços,
 * valida disponibilidade e grava tudo numa transação.
 */
export async function createOrder(input: OrderCreateInput): Promise<CreatedOrder> {
  const sb = createPublicClient();
  return unwrap(await sb.rpc("create_order", { payload: input })) as CreatedOrder;
}

export async function listOrders(
  sb: SessionClient,
  opts: { status?: OrderStatus; q?: string; page: number },
): Promise<{ orders: OrderSummary[]; total: number; page: number; pageSize: number }> {
  const from = (opts.page - 1) * ORDERS_PAGE_SIZE;
  let query = sb
    .from("orders")
    .select(SUMMARY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);

  if (opts.status) query = query.eq("status", opts.status);
  const q = opts.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^#?\d{1,9}$/.test(q)) query = query.eq("code", Number(digits));
    else if (digits.length >= 4) query = query.like("customer_phone", `%${digits}%`);
    else query = query.ilike("customer_name", `%${q.replace(/[%_\\]/g, "")}%`);
  }

  const res = await query;
  const orders = unwrap(res) as OrderSummary[];
  return { orders, total: res.count ?? orders.length, page: opts.page, pageSize: ORDERS_PAGE_SIZE };
}

export async function getOrder(sb: SessionClient, id: string): Promise<Order> {
  const row = unwrap(
    await sb
      .from("orders")
      .select("*, items:order_items(*), events:order_events(id, status, created_at)")
      .eq("id", id)
      .maybeSingle(),
  ) as (Order & { items: Order["items"]; events: Order["events"] }) | null;
  if (!row) throw new ApiError(404, "not_found", "Pedido não encontrado.");
  row.items.sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));
  row.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return row;
}

export async function updateOrder(sb: SessionClient, id: string, input: OrderUpdateInput): Promise<Order> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.delivery_fee_cents !== undefined) patch.delivery_fee_cents = input.delivery_fee_cents;
  if (input.cancel_reason !== undefined) patch.cancel_reason = input.cancel_reason;
  const rows = unwrap(await sb.from("orders").update(patch).eq("id", id).select("id")) as Array<{ id: string }>;
  if (!rows.length) throw new ApiError(404, "not_found", "Pedido não encontrado.");
  return getOrder(sb, id);
}

export async function dashboardStats(sb: SessionClient) {
  const startOfDay = new Date();
  // Início do dia no fuso de São Paulo (UTC-3, sem horário de verão)
  const sp = new Date(startOfDay.getTime() - 3 * 3600_000);
  const dayStartUtc = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3));

  const [today, open, products, recent] = await Promise.all([
    sb.from("orders").select("total_cents, status").gte("created_at", dayStartUtc.toISOString()),
    sb.from("orders").select("id", { count: "exact", head: true })
      .in("status", ["novo", "confirmado", "em_preparo", "saiu_para_entrega", "pronto_para_retirada"]),
    sb.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    sb.from("orders").select(SUMMARY_SELECT).order("created_at", { ascending: false }).limit(8),
  ]);

  const todayRows = (unwrap(today) as Array<{ total_cents: number; status: OrderStatus }>).filter(
    (o) => o.status !== "cancelado",
  );
  unwrap(open);
  unwrap(products);
  return {
    ordersToday: todayRows.length,
    revenueTodayCents: todayRows.reduce((s, o) => s + o.total_cents, 0),
    openOrders: open.count ?? 0,
    activeProducts: products.count ?? 0,
    recent: unwrap(recent) as OrderSummary[],
  };
}
