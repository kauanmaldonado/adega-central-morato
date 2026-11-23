import { createPublicClient } from "@/lib/supabase/server";
import { orderCreateSchema } from "@/lib/validation";
import { buildOrderMessage, whatsappLink } from "@/lib/whatsapp";
import { createOrder } from "@/server/orders";
import { ApiError, json, parseJson, route, unwrap } from "@/server/http";
import { RateLimiter, clientIp } from "@/server/rate-limit";
import type { StoreSettings } from "@/lib/types";

const limiter = new RateLimiter(10, 10 * 60_000); // 10 pedidos / 10 min por IP (por instância)

/**
 * POST /api/orders — cria um pedido a partir do carrinho.
 * Preços e disponibilidade são verificados no banco; o valor enviado pelo
 * navegador é ignorado. Retorna o número do pedido e o link do WhatsApp.
 */
export const POST = route(async (req) => {
  if (!limiter.check(clientIp(req.headers))) {
    throw new ApiError(429, "rate_limited", "Muitas tentativas. Aguarde alguns minutos.");
  }
  const input = await parseJson(req, orderCreateSchema, 16 * 1024);
  const order = await createOrder(input);

  const settings = unwrap(
    await createPublicClient().from("store_settings").select("store_name, whatsapp_number").eq("id", 1).single(),
  ) as Pick<StoreSettings, "store_name" | "whatsapp_number">;

  const message = buildOrderMessage({
    code: order.code,
    storeName: settings.store_name,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    fulfillment: input.fulfillment,
    paymentMethod: input.payment_method,
    address: input.address,
    notes: input.notes,
    subtotalCents: order.subtotal_cents,
    items: order.items.map((i) => ({
      quantity: i.quantity,
      productName: i.product_name,
      variantLabel: i.variant_label,
      lineTotalCents: i.line_total_cents,
    })),
  });

  return json(
    {
      order: { id: order.id, code: order.code, subtotal_cents: order.subtotal_cents, items: order.items },
      whatsapp_url: whatsappLink(settings.whatsapp_number, message),
    },
    { status: 201 },
  );
});
