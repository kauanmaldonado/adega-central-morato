import { test } from "node:test";
import assert from "node:assert/strict";
import { centsToInput, discountPercent, formatBRL, parseBRLToCents } from "../src/lib/money";
import { isValidPhone, maskPhone, normalizePhone, toWhatsAppNumber } from "../src/lib/phone";
import { slugify } from "../src/lib/slug";
import { buildOrderMessage, whatsappLink } from "../src/lib/whatsapp";
import { assertNotSecretKey } from "../src/lib/env";

test("formatBRL", () => {
  assert.equal(formatBRL(1290), "R$ 12,90");
  assert.equal(formatBRL(0), "R$ 0,00");
  assert.equal(formatBRL(123456), "R$ 1.234,56");
});

test("parseBRLToCents aceita formatos brasileiros", () => {
  assert.equal(parseBRLToCents("12,90"), 1290);
  assert.equal(parseBRLToCents("12.90"), 1290);
  assert.equal(parseBRLToCents("12"), 1200);
  assert.equal(parseBRLToCents("R$ 1.234,56"), 123456);
  assert.equal(parseBRLToCents("1.234"), 123400);
  assert.equal(parseBRLToCents("0,1"), 10);
  assert.equal(parseBRLToCents("14,99"), 1499);
});

test("parseBRLToCents rejeita valores inválidos", () => {
  for (const v of ["", "abc", "12,999", "-5", "1,2,3", "12.3.4"]) assert.equal(parseBRLToCents(v), null, v);
});

test("centsToInput e discountPercent", () => {
  assert.equal(centsToInput(1499), "14,99");
  assert.equal(centsToInput(null), "");
  assert.equal(discountPercent(1490, 1690), 12);
  assert.equal(discountPercent(1000, null), null);
  assert.equal(discountPercent(1000, 900), null);
});

test("telefone", () => {
  assert.equal(normalizePhone("(11) 98888-7777"), "11988887777");
  assert.equal(normalizePhone("+55 11 98888-7777"), "11988887777");
  assert.equal(isValidPhone("(11) 3333-4444"), true);
  assert.equal(isValidPhone("98888-7777"), false);
  assert.equal(maskPhone("11988887777"), "(11) 98888-7777");
  assert.equal(maskPhone("1133334444"), "(11) 3333-4444");
  assert.equal(toWhatsAppNumber("(11) 98888-7777"), "5511988887777");
  assert.equal(toWhatsAppNumber("123"), null);
});

test("slugify", () => {
  assert.equal(slugify("Água de Coco 1L"), "agua-de-coco-1l");
  assert.equal(slugify("  Energéticos & Cia!! "), "energeticos-cia");
  assert.equal(slugify("***"), "item");
});

test("mensagem do WhatsApp usa os dados do pedido", () => {
  const msg = buildOrderMessage({
    code: 42,
    storeName: "Adega Central Morato",
    customerName: "Cliente",
    customerPhone: "11988887777",
    fulfillment: "entrega",
    paymentMethod: "pix",
    address: { street: "Rua A", number: "10", district: "Centro", complement: "Apto 2" },
    notes: "Troco para 50",
    subtotalCents: 2950,
    items: [{ quantity: 2, productName: "Produto", variantLabel: "Lata", lineTotalCents: 2950 }],
  });
  assert.match(msg, /Pedido nº 42 · Adega Central Morato/);
  assert.match(msg, /2x Produto \(Lata\) — R\$ 29,50/);
  assert.match(msg, /Total: R\$ 29,50 \+ entrega/);
  assert.match(msg, /Rua A, 10/);
  assert.match(msg, /Complemento: Apto 2/);
  assert.match(msg, /Pagamento:\* Pix/);
  assert.match(msg, /Telefone: \(11\) 98888-7777/);
});

test("whatsappLink só aceita número com DDI 55", () => {
  assert.equal(whatsappLink("5511988887777", "oi a"), "https://wa.me/5511988887777?text=oi%20a");
  assert.equal(whatsappLink("11988887777"), null);
  assert.equal(whatsappLink(null), null);
});

test("chave secreta nunca é aceita como chave pública", () => {
  const jwt = (role: string) =>
    ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "sig"].join(".");
  assert.throws(() => assertNotSecretKey(jwt("service_role")), /service_role/);
  assert.throws(() => assertNotSecretKey("sb_secret_abc123abc123abc123"), /SECRETA/);
  assert.doesNotThrow(() => assertNotSecretKey(jwt("anon")));
  assert.doesNotThrow(() => assertNotSecretKey("sb_publishable_abc123abc123abc123"));
});
