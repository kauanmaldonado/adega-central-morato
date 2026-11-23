/**
 * Esquemas de validação (Zod) usados pelo BACKEND em todas as rotas de API.
 * O frontend pode reutilizá-los para mostrar erros antes do envio, mas a
 * validação que vale é sempre a do servidor (e, por fim, a do banco).
 */
import { z } from "zod";
import { FULFILLMENT_TYPES, ORDER_STATUSES, PAYMENT_METHODS } from "./types";
import { normalizePhone } from "./phone";

const MAX_PRICE_CENTS = 10_000_000; // R$ 100.000,00

/** Converte "" e espaços em null; aplica trim. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
    z.string().max(max, `Use no máximo ${max} caracteres.`).nullable().optional(),
  );

const requiredText = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `Informe ${label}.`, invalid_type_error: `Informe ${label}.` })
    .trim()
    .min(min, min <= 1 ? `Informe ${label}.` : `${capitalize(label)} deve ter pelo menos ${min} caracteres.`)
    .max(max, `Use no máximo ${max} caracteres.`);

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const cents = (label: string) =>
  z
    .number({ invalid_type_error: `${label} inválido.`, required_error: `Informe ${label.toLowerCase()}.` })
    .int(`${label} inválido.`)
    .min(0, `${label} não pode ser negativo.`)
    .max(MAX_PRICE_CENTS, `${label} acima do limite.`);

export const uuidSchema = z.string().uuid("Identificador inválido.");

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  password: z.string().min(8, "Senha inválida.").max(128, "Senha inválida."),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Código de 6 dígitos do app autenticador (segunda etapa do login). */
export const mfaVerifySchema = z.object({
  code: z
    .string({ required_error: "Digite o código de 6 números.", invalid_type_error: "Digite o código de 6 números." })
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[0-9]{6}$/, "Digite o código de 6 números.")),
  // Só no primeiro acesso (cadastro do app autenticador)
  factorId: uuidSchema.optional(),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export const categoryCreateSchema = z.object({
  name: requiredText(1, 60, "o nome da categoria"),
  is_active: z.boolean().default(true),
  position: z.number().int().min(0).max(10_000).default(0),
});
export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.");
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const categoryReorderSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(200),
});

// ---------------------------------------------------------------------------
// Produtos e variações
// ---------------------------------------------------------------------------
export const variantSchema = z
  .object({
    id: uuidSchema.nullable().optional(),
    label: requiredText(1, 60, "o nome da opção"),
    price_cents: cents("Preço"),
    compare_at_cents: cents("Preço \"de\"").nullable().optional(),
    position: z.number().int().min(0).max(1000).default(0),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.compare_at_cents == null || v.compare_at_cents > v.price_cents, {
    message: "O preço \"de\" (riscado) precisa ser maior que o preço atual.",
    path: ["compare_at_cents"],
  });

export const productSchema = z
  .object({
    category_id: uuidSchema,
    name: requiredText(1, 120, "o nome do produto"),
    description: optionalText(500),
    badge: optionalText(20),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    is_new: z.boolean().default(false),
    position: z.number().int().min(0).max(10_000).default(0),
    variants: z.array(variantSchema).min(1, "Cadastre pelo menos uma opção com preço.").max(30),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      const key = v.label.trim().toLocaleLowerCase("pt-BR");
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", i, "label"],
          message: "Já existe uma opção com esse nome.",
        });
      }
      seen.add(key);
    });
  });
export type ProductInput = z.infer<typeof productSchema>;

/** Alteração rápida pela lista de produtos (liga/desliga). */
export const productPatchSchema = z
  .object({
    is_active: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    is_new: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.");

export const imageUpdateSchema = z
  .object({
    alt: optionalText(160),
    position: z.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.");

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

/** Confere a assinatura real do arquivo (não confia na extensão nem no navegador). */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Configurações da loja
// ---------------------------------------------------------------------------
export const settingsSchema = z.object({
  store_name: requiredText(1, 80, "o nome da loja"),
  whatsapp_number: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v) : v),
    z
      .string()
      .transform((v) => normalizePhone(v))
      .refine((v) => /^\d{10,11}$/.test(v), "Informe o WhatsApp com DDD, ex.: (11) 99999-9999.")
      .transform((v) => `55${v}`)
      .nullable(),
  ),
  is_open: z.boolean(),
  opening_hours: optionalText(300),
  address: optionalText(300),
  delivery_info: optionalText(500),
  min_order_cents: cents("Pedido mínimo").nullable(),
  accepted_payment_methods: z
    .array(z.enum(PAYMENT_METHODS))
    .min(1, "Escolha pelo menos uma forma de pagamento.")
    .transform((list) => Array.from(new Set(list))),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Pedidos — criação pelo cliente (cardápio público)
// ---------------------------------------------------------------------------
export const orderCreateSchema = z
  .object({
    customer: z.object({
      name: requiredText(2, 80, "seu nome"),
      phone: z
        .string({ required_error: "Informe um telefone com DDD." })
        .transform((v) => normalizePhone(v))
        .refine((v) => /^\d{10,11}$/.test(v), "Informe um telefone com DDD."),
    }),
    fulfillment: z.enum(FULFILLMENT_TYPES, { errorMap: () => ({ message: "Escolha entrega ou retirada." }) }),
    payment_method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Escolha a forma de pagamento." }) }),
    address: z
      .object({
        street: optionalText(120),
        number: optionalText(20),
        district: optionalText(80),
        complement: optionalText(120),
      })
      .nullable()
      .optional(),
    notes: optionalText(500),
    items: z
      .array(
        z.object({
          variant_id: uuidSchema,
          quantity: z.number().int().min(1, "Quantidade inválida.").max(99, "Quantidade máxima: 99."),
        }),
      )
      .min(1, "Seu carrinho está vazio.")
      .max(50, "Muitos itens em um único pedido."),
  })
  .superRefine((o, ctx) => {
    if (o.fulfillment === "entrega") {
      for (const field of ["street", "number", "district"] as const) {
        if (!o.address?.[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["address", field],
            message: "Preencha rua, número e bairro.",
          });
        }
      }
    }
    const ids = o.items.map((i) => i.variant_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Item repetido no pedido." });
    }
  })
  .transform((o) => ({
    ...o,
    address: o.fulfillment === "entrega" ? o.address ?? null : null,
  }));
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

// ---------------------------------------------------------------------------
// Pedidos — atualização pelo administrador
// ---------------------------------------------------------------------------
export const orderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    delivery_fee_cents: cents("Taxa de entrega").nullable().optional(),
    cancel_reason: optionalText(300),
  })
  .refine((v) => v.status !== undefined || v.delivery_fee_cents !== undefined || v.cancel_reason !== undefined, {
    message: "Nada para atualizar.",
  })
  .refine((v) => v.status !== "cancelado" || !!v.cancel_reason, {
    message: "Informe o motivo do cancelamento.",
    path: ["cancel_reason"],
  });
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

/** Converte erros do Zod em { campo: mensagem } para o frontend. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
