/**
 * Converte erros do PostgreSQL/Supabase em respostas HTTP com mensagens em
 * português. Sem dependências de servidor para poder ser testado isoladamente.
 */
export interface MappedError {
  status: number;
  code: string;
  message: string;
}

const BUSINESS: Record<string, MappedError> = {
  "order:store_closed": { status: 409, code: "store_closed", message: "A loja está fechada no momento. Tente novamente mais tarde." },
  "order:invalid_name": { status: 422, code: "invalid_name", message: "Informe seu nome." },
  "order:invalid_phone": { status: 422, code: "invalid_phone", message: "Informe um telefone com DDD." },
  "order:invalid_option": { status: 422, code: "invalid_option", message: "Opção de entrega ou pagamento inválida." },
  "order:payment_not_accepted": { status: 422, code: "payment_not_accepted", message: "Essa forma de pagamento não está disponível." },
  "order:address_required": { status: 422, code: "address_required", message: "Preencha rua, número e bairro." },
  "order:invalid_address": { status: 422, code: "invalid_address", message: "Endereço inválido." },
  "order:invalid_notes": { status: 422, code: "invalid_notes", message: "Observação muito longa." },
  "order:invalid_items": { status: 422, code: "invalid_items", message: "Itens do pedido inválidos." },
  "order:duplicated_item": { status: 422, code: "duplicated_item", message: "Item repetido no pedido." },
  "order:item_unavailable": { status: 409, code: "item_unavailable", message: "Um dos itens do carrinho não está mais disponível. Atualize o cardápio." },
  "order:below_minimum": { status: 422, code: "below_minimum", message: "O pedido não atingiu o valor mínimo." },
  "order:too_many_orders": { status: 429, code: "too_many_orders", message: "Muitos pedidos seguidos com este telefone. Aguarde alguns minutos." },
  "order:status_locked": { status: 409, code: "status_locked", message: "Pedidos concluídos ou cancelados não podem mudar de status." },
  "order:cancel_reason_required": { status: 422, code: "cancel_reason_required", message: "Informe o motivo do cancelamento." },
  "product:variants_required": { status: 422, code: "variants_required", message: "Cadastre pelo menos uma opção com preço." },
  "product:not_found": { status: 404, code: "not_found", message: "Produto não encontrado." },
  "product:variant_not_found": { status: 409, code: "variant_not_found", message: "Uma das opções foi alterada por outra pessoa. Recarregue a página." },
  "auth:forbidden": { status: 403, code: "forbidden", message: "Acesso negado." },
};

export function mapDbError(err: { code?: string | null; message?: string | null; details?: string | null }): MappedError {
  const message = err.message ?? "";
  const key = Object.keys(BUSINESS).find((k) => message === k || message.startsWith(`${k}`));
  if (key) return BUSINESS[key]!;

  switch (err.code) {
    case "23505":
      return { status: 409, code: "duplicate", message: "Já existe um registro com esses dados." };
    case "23503":
      return {
        status: 409,
        code: "in_use",
        message: "Este item está vinculado a outros registros e não pode ser excluído. Desative-o em vez de excluir.",
      };
    case "23514":
    case "22P02":
    case "22001":
      return { status: 422, code: "invalid_data", message: "Dados inválidos." };
    case "42501":
      return { status: 403, code: "forbidden", message: "Acesso negado." };
    case "PGRST116":
      return { status: 404, code: "not_found", message: "Registro não encontrado." };
    default:
      return { status: 500, code: "internal_error", message: "Erro interno. Tente novamente." };
  }
}
