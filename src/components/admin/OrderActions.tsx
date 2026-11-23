"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import { FINAL_STATUSES, STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";
import { api, ApiClientError } from "./api";

/** Próximos passos sugeridos para cada status. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  novo: ["confirmado", "cancelado"],
  confirmado: ["em_preparo", "cancelado"],
  em_preparo: ["saiu_para_entrega", "pronto_para_retirada", "cancelado"],
  saiu_para_entrega: ["concluido", "cancelado"],
  pronto_para_retirada: ["concluido", "cancelado"],
  concluido: [],
  cancelado: [],
};

export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [fee, setFee] = useState(centsToInput(order.delivery_fee_cents));
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const locked = FINAL_STATUSES.includes(order.status);
  const options = NEXT[order.status].filter((s) =>
    order.fulfillment === "retirada" ? s !== "saiu_para_entrega" : s !== "pronto_para_retirada",
  );

  async function update(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body });
      setMsg({ ok: true, text: okText });
      setCancelling(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : "Não foi possível salvar." });
    } finally {
      setBusy(false);
    }
  }

  function saveFee() {
    const trimmed = fee.trim();
    const cents = trimmed === "" ? null : parseBRLToCents(trimmed);
    if (trimmed !== "" && cents === null) {
      setMsg({ ok: false, text: "Valor da taxa inválido. Ex.: 7,00" });
      return;
    }
    void update({ delivery_fee_cents: cents }, "Taxa de entrega salva.");
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Atualizar pedido</h2>
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`} role="status">{msg.text}</p>}

      {locked ? (
        <p className="muted" style={{ margin: 0 }}>Pedido {STATUS_LABELS[order.status].toLowerCase()}: não pode mais ser alterado.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {options.filter((s) => s !== "cancelado").map((s) => (
              <button key={s} type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => update({ status: s }, `Status: ${STATUS_LABELS[s]}.`)}>
                Marcar como {STATUS_LABELS[s].toLowerCase()}
              </button>
            ))}
            {!cancelling && (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setCancelling(true)}>
                Cancelar pedido
              </button>
            )}
          </div>

          {cancelling && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="field">
                <span>Motivo do cancelamento</span>
                <input className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy || !reason.trim()} onClick={() => update({ status: "cancelado", cancel_reason: reason }, "Pedido cancelado.")}>
                  Confirmar cancelamento
                </button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => setCancelling(false)}>Voltar</button>
              </div>
            </div>
          )}

          {order.fulfillment === "entrega" && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Taxa de entrega (R$)</span>
                <input className="input" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0,00" />
              </label>
              <button type="button" className="btn btn-light" style={{ height: 48 }} disabled={busy} onClick={saveFee}>Salvar</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
