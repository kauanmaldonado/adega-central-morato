import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageType,
  fieldErrors,
  orderCreateSchema,
  orderUpdateSchema,
  productSchema,
  settingsSchema,
} from "../src/lib/validation";

const UUID_A = "30000000-0000-4000-8000-000000000001";
const UUID_B = "30000000-0000-4000-8000-000000000002";

const baseOrder = {
  customer: { name: "  Cliente Teste  ", phone: "(11) 98888-7777" },
  fulfillment: "retirada",
  payment_method: "pix",
  items: [{ variant_id: UUID_A, quantity: 2 }],
};

test("pedido válido é normalizado", () => {
  const o = orderCreateSchema.parse({ ...baseOrder, notes: "   " });
  assert.equal(o.customer.name, "Cliente Teste");
  assert.equal(o.customer.phone, "11988887777");
  assert.equal(o.notes, null);
  assert.equal(o.address, null);
});

test("entrega exige rua, número e bairro", () => {
  const r = orderCreateSchema.safeParse({ ...baseOrder, fulfillment: "entrega", address: { street: "Rua A" } });
  assert.equal(r.success, false);
  if (!r.success) {
    const f = fieldErrors(r.error);
    assert.ok(f["address.number"]);
    assert.ok(f["address.district"]);
  }
});

test("retirada descarta o endereço enviado", () => {
  const o = orderCreateSchema.parse({ ...baseOrder, address: { street: "X", number: "1", district: "Y" } });
  assert.equal(o.address, null);
});

test("pedido rejeita dados inválidos", () => {
  const bad = [
    { ...baseOrder, customer: { name: "A", phone: "11988887777" } },
    { ...baseOrder, customer: { name: "Cliente", phone: "8888" } },
    { ...baseOrder, fulfillment: "drone" },
    { ...baseOrder, payment_method: "boleto" },
    { ...baseOrder, items: [] },
    { ...baseOrder, items: [{ variant_id: "x", quantity: 1 }] },
    { ...baseOrder, items: [{ variant_id: UUID_A, quantity: 0 }] },
    { ...baseOrder, items: [{ variant_id: UUID_A, quantity: 100 }] },
    { ...baseOrder, items: [{ variant_id: UUID_A, quantity: 1.5 }] },
    { ...baseOrder, items: [{ variant_id: UUID_A, quantity: 1 }, { variant_id: UUID_A, quantity: 2 }] },
    { ...baseOrder, notes: "x".repeat(501) },
  ];
  for (const b of bad) assert.equal(orderCreateSchema.safeParse(b).success, false, JSON.stringify(b).slice(0, 80));
});

test("pedido ignora campos extras como preço vindo do navegador", () => {
  const o = orderCreateSchema.parse({ ...baseOrder, items: [{ variant_id: UUID_B, quantity: 1, price_cents: 1 }] }) as unknown as {
    items: Array<Record<string, unknown>>;
  };
  assert.deepEqual(Object.keys(o.items[0]!).sort(), ["quantity", "variant_id"]);
});

const baseProduct = {
  category_id: UUID_A,
  name: "Produto",
  variants: [{ label: "Lata", price_cents: 600 }],
};

test("produto válido recebe valores padrão", () => {
  const p = productSchema.parse(baseProduct);
  assert.equal(p.is_active, true);
  assert.equal(p.is_featured, false);
  assert.equal(p.variants[0]!.is_active, true);
});

test("produto: preço 'de' deve ser maior que o preço", () => {
  const r = productSchema.safeParse({ ...baseProduct, variants: [{ label: "Lata", price_cents: 600, compare_at_cents: 500 }] });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(fieldErrors(r.error)["variants.0.compare_at_cents"]);
});

test("produto: opções repetidas, sem opção, preço negativo e fracionado são rejeitados", () => {
  const bad = [
    { ...baseProduct, variants: [] },
    { ...baseProduct, variants: [{ label: "Lata", price_cents: 1 }, { label: " lata ", price_cents: 2 }] },
    { ...baseProduct, variants: [{ label: "Lata", price_cents: -1 }] },
    { ...baseProduct, variants: [{ label: "Lata", price_cents: 1.5 }] },
    { ...baseProduct, name: "   " },
    { ...baseProduct, category_id: "x" },
  ];
  for (const b of bad) assert.equal(productSchema.safeParse(b).success, false, JSON.stringify(b).slice(0, 80));
});

test("configurações: WhatsApp é normalizado com DDI", () => {
  const s = settingsSchema.parse({
    store_name: "Adega Central Morato",
    whatsapp_number: "(11) 99999-0000",
    is_open: true,
    min_order_cents: null,
    accepted_payment_methods: ["pix", "pix", "debito"],
  });
  assert.equal(s.whatsapp_number, "5511999990000");
  assert.deepEqual(s.accepted_payment_methods, ["pix", "debito"]);
  const empty = settingsSchema.parse({ store_name: "X", whatsapp_number: "", is_open: false, min_order_cents: null, accepted_payment_methods: ["pix"] });
  assert.equal(empty.whatsapp_number, null);
  assert.equal(
    settingsSchema.safeParse({ store_name: "X", whatsapp_number: "123", is_open: true, min_order_cents: null, accepted_payment_methods: ["pix"] }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({ store_name: "X", whatsapp_number: null, is_open: true, min_order_cents: null, accepted_payment_methods: [] }).success,
    false,
  );
});

test("atualização de pedido: cancelamento exige motivo", () => {
  assert.equal(orderUpdateSchema.safeParse({ status: "cancelado" }).success, false);
  assert.equal(orderUpdateSchema.safeParse({ status: "cancelado", cancel_reason: "Cliente desistiu" }).success, true);
  assert.equal(orderUpdateSchema.safeParse({}).success, false);
  assert.equal(orderUpdateSchema.safeParse({ delivery_fee_cents: null }).success, true);
  assert.equal(orderUpdateSchema.safeParse({ status: "inventado" }).success, false);
});

test("detecção do tipo real de imagem", () => {
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("GIF89a")), null);
});
