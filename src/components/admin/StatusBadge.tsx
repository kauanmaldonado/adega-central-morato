import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

const STYLE: Record<OrderStatus, React.CSSProperties> = {
  novo: { background: "#0d0d0d", color: "#fff" },
  confirmado: { background: "#e6eefb", color: "#1f4b99" },
  em_preparo: { background: "#fbf1dc", color: "#7a4f00" },
  saiu_para_entrega: { background: "#ece6fb", color: "#4b2a99" },
  pronto_para_retirada: { background: "#ece6fb", color: "#4b2a99" },
  concluido: { background: "#e5f2ea", color: "#1d6b3a" },
  cancelado: { background: "#f2f2f0", color: "#6b6b67", textDecoration: "line-through" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="pill" style={STYLE[status]}>
      {STATUS_LABELS[status]}
    </span>
  );
}
