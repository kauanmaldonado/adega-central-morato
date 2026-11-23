/** Tipos de domínio compartilhados entre backend e frontend (sem dependências). */

export const PAYMENT_METHODS = ["pix", "credito", "debito", "dinheiro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FULFILLMENT_TYPES = ["entrega", "retirada"] as const;
export type Fulfillment = (typeof FULFILLMENT_TYPES)[number];

export const ORDER_STATUSES = [
  "novo",
  "confirmado",
  "em_preparo",
  "saiu_para_entrega",
  "pronto_para_retirada",
  "concluido",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
};

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  entrega: "Entrega",
  retirada: "Retirada na adega",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  pronto_para_retirada: "Pronto para retirada",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Status finais não podem ser alterados (regra também garantida no banco). */
export const FINAL_STATUSES: readonly OrderStatus[] = ["concluido", "cancelado"];

export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithCount extends Category {
  product_count: number;
}

export interface Variant {
  id: string;
  product_id: string;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  position: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt: string | null;
  position: number;
  /** URL pública montada pelo backend */
  url: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  badge: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  variants: Variant[];
  images: ProductImage[];
}

export interface StoreSettings {
  store_name: string;
  whatsapp_number: string | null;
  is_open: boolean;
  opening_hours: string | null;
  address: string | null;
  delivery_info: string | null;
  min_order_cents: number | null;
  accepted_payment_methods: PaymentMethod[];
  updated_at: string;
}

/** Dados públicos do cardápio, montados pelo backend. */
export interface Catalog {
  settings: StoreSettings;
  categories: Array<Category & { products: Product[] }>;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export interface OrderEvent {
  id: number;
  status: OrderStatus;
  created_at: string;
}

export interface OrderSummary {
  id: string;
  code: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  payment_method: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  subtotal_cents: number;
  delivery_fee_cents: number | null;
  total_cents: number;
  created_at: string;
}

export interface Order extends OrderSummary {
  customer_id: string;
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_complement: string | null;
  notes: string | null;
  cancel_reason: string | null;
  updated_at: string;
  items: OrderItem[];
  events: OrderEvent[];
}

/** Formato padrão de erro devolvido pela API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
