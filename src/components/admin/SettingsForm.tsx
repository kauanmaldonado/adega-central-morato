"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { PAYMENT_LABELS, PAYMENT_METHODS, type PaymentMethod, type StoreSettings } from "@/lib/types";
import { api, ApiClientError } from "./api";
import styles from "./admin.module.css";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    store_name: settings.store_name,
    whatsapp: settings.whatsapp_number ? maskPhone(settings.whatsapp_number.slice(2)) : "",
    is_open: settings.is_open,
    opening_hours: settings.opening_hours ?? "",
    address: settings.address ?? "",
    delivery_info: settings.delivery_info ?? "",
    min_order: centsToInput(settings.min_order_cents),
    payments: settings.accepted_payment_methods,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const minOrder = s.min_order.trim() ? parseBRLToCents(s.min_order) : null;
    if (s.min_order.trim() && minOrder === null) {
      setErrors({ min_order_cents: "Valor inválido. Ex.: 30,00" });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: {
          store_name: s.store_name,
          whatsapp_number: s.whatsapp,
          is_open: s.is_open,
          opening_hours: s.opening_hours,
          address: s.address,
          delivery_info: s.delivery_info,
          min_order_cents: minOrder,
          accepted_payment_methods: s.payments,
        },
      });
      setMessage({ ok: true, text: "Configurações salvas. O cardápio já foi atualizado." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fields);
        setMessage({ ok: false, text: err.message });
      } else setMessage({ ok: false, text: "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  const togglePay = (m: PaymentMethod) =>
    setS((x) => ({ ...x, payments: x.payments.includes(m) ? x.payments.filter((p) => p !== m) : [...x.payments, m] }));

  return (
    <form className="card" onSubmit={save} noValidate style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`} role="status">{message.text}</p>}

      <label className="check" style={{ fontWeight: 600 }}>
        <input type="checkbox" checked={s.is_open} onChange={(e) => setS({ ...s, is_open: e.target.checked })} />
        Loja aberta para pedidos
      </label>

      <div className={styles.grid2}>
        <label className="field">
          <span>Nome da loja</span>
          <input className="input" value={s.store_name} maxLength={80} onChange={(e) => setS({ ...s, store_name: e.target.value })} />
          {errors.store_name && <span className="field-error">{errors.store_name}</span>}
        </label>
        <label className="field">
          <span>WhatsApp que recebe os pedidos</span>
          <input className="input" inputMode="tel" value={s.whatsapp} placeholder="(11) 99999-9999" onChange={(e) => setS({ ...s, whatsapp: maskPhone(e.target.value) })} aria-invalid={!!errors.whatsapp_number} />
          {errors.whatsapp_number && <span className="field-error">{errors.whatsapp_number}</span>}
        </label>
      </div>

      <label className="field">
        <span>Endereço da adega</span>
        <input className="input" value={s.address} maxLength={300} onChange={(e) => setS({ ...s, address: e.target.value })} />
      </label>
      <label className="field">
        <span>Horário de funcionamento</span>
        <textarea className="textarea" rows={2} maxLength={300} value={s.opening_hours} onChange={(e) => setS({ ...s, opening_hours: e.target.value })} />
      </label>
      <label className="field">
        <span>Informações de entrega</span>
        <textarea className="textarea" rows={2} maxLength={500} value={s.delivery_info} onChange={(e) => setS({ ...s, delivery_info: e.target.value })} placeholder="Aparece no checkout. Ex.: bairros atendidos e como a taxa é calculada." />
      </label>

      <div className={styles.grid2}>
        <label className="field">
          <span>Pedido mínimo (R$) <span className="muted">— opcional</span></span>
          <input className="input" inputMode="decimal" value={s.min_order} placeholder="Sem mínimo" onChange={(e) => setS({ ...s, min_order: e.target.value })} aria-invalid={!!errors.min_order_cents} />
          {errors.min_order_cents && <span className="field-error">{errors.min_order_cents}</span>}
        </label>
        <fieldset className={styles.fieldset} style={{ padding: 0, border: 0 }}>
          <legend className="label">Formas de pagamento aceitas</legend>
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className="check" style={{ minHeight: 36 }}>
              <input type="checkbox" checked={s.payments.includes(m)} onChange={() => togglePay(m)} /> {PAYMENT_LABELS[m]}
            </label>
          ))}
          {errors.accepted_payment_methods && <span className="field-error">{errors.accepted_payment_methods}</span>}
        </fieldset>
      </div>

      <button type="submit" className="btn btn-dark" style={{ height: 52 }} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button>
    </form>
  );
}
