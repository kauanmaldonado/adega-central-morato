"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { formatBRL } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { PAYMENT_LABELS, type ApiErrorBody, type Catalog, type Fulfillment, type PaymentMethod } from "@/lib/types";
import { resolveCart, useCart } from "./cart";
import styles from "./checkout.module.css";

const FORM_KEY = "acm_checkout_v2";

interface FormState {
  name: string;
  phone: string;
  fulfillment: Fulfillment;
  street: string;
  number: string;
  district: string;
  complement: string;
  payment: PaymentMethod | "";
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  fulfillment: "entrega",
  street: "",
  number: "",
  district: "",
  complement: "",
  payment: "",
  notes: "",
};

const PAYMENT_HINTS: Record<PaymentMethod, string> = {
  pix: "Chave enviada pelo WhatsApp",
  credito: "Na entrega ou na retirada",
  debito: "Na entrega ou na retirada",
  dinheiro: "Informe nas observações se precisa de troco",
};

interface Success {
  code: number;
  subtotal: number;
  count: number;
  whatsappUrl: string | null;
  fulfillment: Fulfillment;
}

export function Checkout({ catalog }: { catalog: Catalog }) {
  const { settings } = catalog;
  const cart = useCart();
  const lines = useMemo(() => resolveCart(catalog, cart.entries), [catalog, cart.entries]);
  const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  // Lembra nome/telefone/endereço neste aparelho (nunca as observações)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FORM_KEY) ?? "{}") as Partial<FormState>;
      setForm((f) => ({ ...f, ...saved, notes: "", payment: "" }));
    } catch {
      /* sem armazenamento disponível */
    }
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key === "name" ? "customer.name" : key === "phone" ? "customer.phone" : `address.${key}`];
      delete next[key];
      if (key === "payment") delete next.payment_method;
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFormError(null);
    setErrors({});

    const local: Record<string, string> = {};
    if (form.name.trim().length < 2) local["customer.name"] = "Informe seu nome.";
    if (form.phone.replace(/\D/g, "").length < 10) local["customer.phone"] = "Informe um telefone com DDD.";
    if (form.fulfillment === "entrega" && (!form.street.trim() || !form.number.trim() || !form.district.trim()))
      local["address.street"] = "Preencha rua, número e bairro.";
    if (!form.payment) local.payment_method = "Escolha a forma de pagamento.";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError("Confira os campos destacados.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, phone: form.phone },
          fulfillment: form.fulfillment,
          payment_method: form.payment,
          address:
            form.fulfillment === "entrega"
              ? { street: form.street, number: form.number, district: form.district, complement: form.complement }
              : null,
          notes: form.notes,
          items: lines.map((l) => ({ variant_id: l.variant.id, quantity: l.qty })),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { order: { code: number; subtotal_cents: number }; whatsapp_url: string | null }
        | ApiErrorBody
        | null;

      if (!res.ok || !body || "error" in body) {
        const err = body && "error" in body ? body.error : null;
        setErrors(err?.fields ?? {});
        setFormError(err?.message ?? "Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      try {
        const { notes: _n, payment: _p, ...keep } = form;
        localStorage.setItem(FORM_KEY, JSON.stringify(keep));
      } catch {
        /* ignore */
      }
      cart.clear();
      setSuccess({
        code: body.order.code,
        subtotal: body.order.subtotal_cents,
        count,
        whatsappUrl: body.whatsapp_url,
        fulfillment: form.fulfillment,
      });
      window.scrollTo(0, 0);
    } catch {
      setFormError("Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return (
      <main className={styles.done}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt={settings.store_name} width={130} height={59} className={styles.doneLogo} />
        <div className={styles.doneBody}>
          <span className={styles.doneCheck} aria-hidden="true"><Icon name="check" size={36} stroke={2.4} /></span>
          <h1 className="serif" style={{ fontSize: 46, lineHeight: 1, margin: 0 }}>
            Pedido <em>nº {success.code}</em>
          </h1>
          {success.whatsappUrl ? (
            <p>Seu pedido foi registrado. Agora toque em <strong>Enviar pelo WhatsApp</strong>: a mensagem já vai pronta para você confirmar{success.fulfillment === "entrega" ? " e combinar a entrega" : ""}.</p>
          ) : (
            <p>Seu pedido foi registrado. A loja vai entrar em contato pelo telefone informado.</p>
          )}
          <div className={styles.doneTotal}>
            <span>{success.count} {success.count === 1 ? "item" : "itens"}</span>
            <strong>{formatBRL(success.subtotal)}{success.fulfillment === "entrega" ? " + entrega" : ""}</strong>
          </div>
        </div>
        <div className={styles.doneActions}>
          {success.whatsappUrl && (
            <a className="btn" href={success.whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#fff", color: "#0d0d0d", height: 56 }}>
              <Icon name="chat" /> Enviar pelo WhatsApp
            </a>
          )}
          <Link className="btn" href="/" style={{ border: "1px solid #3a3a38", color: "#fff", height: 56 }}>
            Fazer novo pedido
          </Link>
        </div>
      </main>
    );
  }

  const fieldError = (key: string) => errors[key];

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <Link href="/" className="icon-btn" aria-label="Voltar ao cardápio"><Icon name="back" /></Link>
        <h1 className="serif" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>Finalizar pedido</h1>
      </div>

      {cart.ready && lines.length === 0 ? (
        <div className={styles.empty}>
          <p className="muted">Seu carrinho está vazio.</p>
          <Link href="/" className="btn btn-dark">Ver cardápio</Link>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          {formError && <p className="alert alert-error" role="alert">{formError}</p>}
          {!settings.is_open && <p className="alert alert-info">A loja está fechada no momento e não está recebendo pedidos.</p>}

          <section className={styles.section}>
            <h2 className={styles.step}>— 01 · Seus dados</h2>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} aria-invalid={!!fieldError("customer.name")} />
              {fieldError("customer.name") && <span className="field-error">{fieldError("customer.name")}</span>}
            </label>
            <label className="field">
              <span>Telefone / WhatsApp</span>
              <input className="input" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" aria-invalid={!!fieldError("customer.phone")} />
              {fieldError("customer.phone") && <span className="field-error">{fieldError("customer.phone")}</span>}
            </label>
          </section>

          <section className={styles.section}>
            <h2 className={styles.step}>— 02 · Entrega</h2>
            <div className={styles.segment} role="radiogroup" aria-label="Entrega ou retirada">
              {(["entrega", "retirada"] as const).map((m) => (
                <label key={m} className={form.fulfillment === m ? styles.segOn : styles.seg}>
                  <input type="radio" name="fulfillment" value={m} checked={form.fulfillment === m} onChange={() => set("fulfillment", m)} className="sr-only" />
                  {m === "entrega" ? "Entrega" : "Retirar na adega"}
                </label>
              ))}
            </div>
            {form.fulfillment === "entrega" ? (
              <>
                <div className={styles.addrRow}>
                  <label className="field">
                    <span>Rua</span>
                    <input className="input" value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" maxLength={120} aria-invalid={!!(fieldError("address.street") && !form.street)} />
                  </label>
                  <label className="field">
                    <span>Número</span>
                    <input className="input" value={form.number} onChange={(e) => set("number", e.target.value)} maxLength={20} aria-invalid={!!(fieldError("address.street") && !form.number) || !!fieldError("address.number")} />
                  </label>
                </div>
                <label className="field">
                  <span>Bairro</span>
                  <input className="input" value={form.district} onChange={(e) => set("district", e.target.value)} maxLength={80} aria-invalid={!!(fieldError("address.street") && !form.district) || !!fieldError("address.district")} />
                </label>
                <label className="field">
                  <span>Complemento e referência <span className="muted">(opcional)</span></span>
                  <input className="input" value={form.complement} onChange={(e) => set("complement", e.target.value)} maxLength={120} />
                </label>
                {(fieldError("address.street") || fieldError("address.number") || fieldError("address.district")) && (
                  <span className="field-error">Preencha rua, número e bairro.</span>
                )}
                <p className="hint">{settings.delivery_info || "A taxa de entrega é combinada pelo WhatsApp de acordo com o seu endereço."}</p>
              </>
            ) : (
              <div className={styles.pickup}>
                <strong>Retirada no balcão</strong>
                <span>{settings.address ? `${settings.address}. ` : ""}Avisamos pelo WhatsApp quando o pedido estiver separado. Sem taxa de entrega.</span>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.step}>— 03 · Pagamento</h2>
            <div role="radiogroup" aria-label="Forma de pagamento" className={styles.payList}>
              {settings.accepted_payment_methods.map((m) => (
                <label key={m} className={form.payment === m ? styles.payOn : styles.pay}>
                  <input type="radio" name="payment" value={m} checked={form.payment === m} onChange={() => set("payment", m)} />
                  <span>
                    <strong>{PAYMENT_LABELS[m]}</strong>
                    <span className="muted">{PAYMENT_HINTS[m]}</span>
                  </span>
                </label>
              ))}
            </div>
            {fieldError("payment_method") && <span className="field-error">{fieldError("payment_method")}</span>}
          </section>

          <section className={styles.section}>
            <h2 className={styles.step}>— 04 · Observações</h2>
            <label className="field">
              <span className="sr-only">Observações</span>
              <textarea className="textarea" rows={3} maxLength={500} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: trazer troco, gelo bem trincado, tocar o interfone" />
            </label>
          </section>

          <section className={styles.summary} aria-label="Resumo do pedido">
            <h2 className="serif" style={{ fontSize: 24, margin: 0, fontWeight: 400 }}>Resumo</h2>
            {lines.map((l) => (
              <div key={l.variant.id} className={styles.sumLine}>
                <span>{l.qty}× {l.product.name} <span className={styles.sumMuted}>{l.variant.label}</span></span>
                <span>{formatBRL(l.totalCents)}</span>
              </div>
            ))}
            <hr />
            <div className={styles.sumLine}><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
            <div className={styles.sumLine}><span>Entrega</span><span>{form.fulfillment === "retirada" ? "Retirada · grátis" : "A combinar"}</span></div>
            <div className={styles.sumTotal}><span>Total</span><span>{formatBRL(subtotal)}</span></div>
            <span className={styles.sumMuted}>
              {form.fulfillment === "retirada" ? "Retirada no balcão, sem taxa." : "Mais a taxa de entrega, combinada pelo WhatsApp."} Os preços são confirmados no envio.
            </span>
            {settings.min_order_cents != null && subtotal < settings.min_order_cents && (
              <span className={styles.sumMuted}>Pedido mínimo: {formatBRL(settings.min_order_cents)}.</span>
            )}
          </section>

          <div className={styles.submitBar}>
            <button type="submit" className="btn btn-dark btn-block" style={{ height: 60, fontSize: 16 }} disabled={sending || !settings.is_open || !cart.ready}>
              <Icon name="chat" />
              {sending ? "Enviando…" : "Enviar pedido"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
