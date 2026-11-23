-- =============================================================================
-- Funções de negócio executadas no banco (transacionais)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- create_order(payload): cria um pedido de forma segura.
--
-- • Executa como SECURITY DEFINER: visitantes (anon) não têm permissão de
--   escrita em nenhuma tabela; esta função é a única porta de entrada.
-- • Os PREÇOS SÃO LIDOS DO BANCO — valores enviados pelo navegador são
--   ignorados, impedindo adulteração de preço.
-- • Valida tudo de novo, mesmo que a API já tenha validado.
--
-- payload (jsonb):
-- {
--   "customer": { "name": text, "phone": "11999999999" },
--   "fulfillment": "entrega" | "retirada",
--   "payment_method": "pix" | "credito" | "debito" | "dinheiro",
--   "address": { "street", "number", "district", "complement" } | null,
--   "notes": text | null,
--   "items": [ { "variant_id": uuid, "quantity": 1..99 }, ... ]
-- }
--
-- Erros são lançados com mensagens estáveis (prefixo "order:") que a API
-- converte em respostas HTTP amigáveis.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings      public.store_settings;
  v_name          text;
  v_phone         text;
  v_fulfillment   public.fulfillment_type;
  v_payment       public.payment_method;
  v_street        text;
  v_number        text;
  v_district      text;
  v_complement    text;
  v_notes         text;
  v_items         jsonb;
  v_item          jsonb;
  v_customer_id   uuid;
  v_order_id      uuid;
  v_order_code    bigint;
  v_subtotal      integer := 0;
  v_recent        integer;
  v_line          record;
  v_qty           integer;
  v_variant_id    uuid;
  v_seen          uuid[] := '{}';
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'order:invalid_payload';
  end if;

  select * into v_settings from public.store_settings where id = 1;
  if not v_settings.is_open then
    raise exception 'order:store_closed';
  end if;

  -- Cliente
  v_name  := btrim(coalesce(payload #>> '{customer,name}', ''));
  v_phone := regexp_replace(coalesce(payload #>> '{customer,phone}', ''), '[^0-9]', '', 'g');
  if char_length(v_name) not between 2 and 80 then
    raise exception 'order:invalid_name';
  end if;
  if v_phone !~ '^[0-9]{10,11}$' then
    raise exception 'order:invalid_phone';
  end if;

  -- Entrega / pagamento
  begin
    v_fulfillment := (payload ->> 'fulfillment')::public.fulfillment_type;
    v_payment     := (payload ->> 'payment_method')::public.payment_method;
  exception when invalid_text_representation then
    raise exception 'order:invalid_option';
  end;
  if v_fulfillment is null or v_payment is null then
    raise exception 'order:invalid_option';
  end if;
  if not (v_payment = any (v_settings.accepted_payment_methods)) then
    raise exception 'order:payment_not_accepted';
  end if;

  if v_fulfillment = 'entrega' then
    v_street     := nullif(btrim(coalesce(payload #>> '{address,street}', '')), '');
    v_number     := nullif(btrim(coalesce(payload #>> '{address,number}', '')), '');
    v_district   := nullif(btrim(coalesce(payload #>> '{address,district}', '')), '');
    v_complement := nullif(btrim(coalesce(payload #>> '{address,complement}', '')), '');
    if v_street is null or v_number is null or v_district is null then
      raise exception 'order:address_required';
    end if;
    if char_length(v_street) > 120 or char_length(v_number) > 20
       or char_length(v_district) > 80 or char_length(coalesce(v_complement, '')) > 120 then
      raise exception 'order:invalid_address';
    end if;
  end if;

  v_notes := nullif(btrim(coalesce(payload ->> 'notes', '')), '');
  if char_length(coalesce(v_notes, '')) > 500 then
    raise exception 'order:invalid_notes';
  end if;

  -- Itens
  v_items := payload -> 'items';
  if v_items is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 50 then
    raise exception 'order:invalid_items';
  end if;

  -- Limite simples contra abuso: no máximo 5 pedidos por telefone em 10 minutos
  select count(*) into v_recent
  from public.orders
  where customer_phone = v_phone and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'order:too_many_orders';
  end if;

  -- Cliente: cria ou atualiza o nome pelo telefone
  insert into public.customers (name, phone)
  values (v_name, v_phone)
  on conflict (phone) do update set name = excluded.name
  returning id into v_customer_id;

  insert into public.orders (
    customer_id, fulfillment, payment_method, customer_name, customer_phone,
    address_street, address_number, address_district, address_complement,
    notes, subtotal_cents
  ) values (
    v_customer_id, v_fulfillment, v_payment, v_name, v_phone,
    v_street, v_number, v_district, v_complement,
    v_notes, 0
  )
  returning id, code into v_order_id, v_order_code;

  for v_item in select * from jsonb_array_elements(v_items) loop
    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_qty        := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'order:invalid_items';
    end;
    if v_variant_id is null or v_qty is null or v_qty not between 1 and 99 then
      raise exception 'order:invalid_items';
    end if;
    if v_variant_id = any (v_seen) then
      raise exception 'order:duplicated_item';
    end if;
    v_seen := v_seen || v_variant_id;

    -- Só aceita variação ativa, de produto ativo, de categoria ativa
    select v.id as variant_id, v.label, v.price_cents, p.id as product_id, p.name
      into v_line
    from public.product_variants v
    join public.products p   on p.id = v.product_id
    join public.categories c on c.id = p.category_id
    where v.id = v_variant_id and v.is_active and p.is_active and c.is_active;

    if not found then
      raise exception 'order:item_unavailable';
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_label, unit_price_cents, quantity
    ) values (
      v_order_id, v_line.product_id, v_line.variant_id, v_line.name, v_line.label, v_line.price_cents, v_qty
    );

    v_subtotal := v_subtotal + v_line.price_cents * v_qty;
  end loop;

  if v_settings.min_order_cents is not null and v_subtotal < v_settings.min_order_cents then
    raise exception 'order:below_minimum';
  end if;

  update public.orders set subtotal_cents = v_subtotal where id = v_order_id;

  -- Devolve o que foi gravado (o visitante não tem permissão de ler pedidos)
  return jsonb_build_object(
    'id', v_order_id,
    'code', v_order_code,
    'subtotal_cents', v_subtotal,
    'items', (
      select jsonb_agg(jsonb_build_object(
               'product_name', oi.product_name,
               'variant_label', oi.variant_label,
               'quantity', oi.quantity,
               'unit_price_cents', oi.unit_price_cents,
               'line_total_cents', oi.line_total_cents
             ) order by oi.product_name, oi.variant_label)
      from public.order_items oi
      where oi.order_id = v_order_id
    )
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_save_product(payload): cria/atualiza um produto e suas variações em
-- uma única transação. Roda com as permissões de quem chama (SECURITY
-- INVOKER), então as políticas RLS de administrador se aplicam.
--
-- payload:
-- {
--   "id": uuid | null,            -- null = novo produto
--   "category_id": uuid,
--   "name", "slug", "description", "badge",
--   "is_active", "is_featured", "is_new", "position",
--   "variants": [ { "id": uuid|null, "label", "price_cents",
--                   "compare_at_cents", "position", "is_active" } ]
-- }
-- Variações existentes que não vierem no payload são removidas.
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_product(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id       uuid := nullif(payload ->> 'id', '')::uuid;
  v_slug     text := payload ->> 'slug';
  v_variant  jsonb;
  v_keep     uuid[] := '{}';
  v_vid      uuid;
begin
  if not public.is_admin() then
    raise exception 'auth:forbidden' using errcode = '42501';
  end if;

  if jsonb_typeof(payload -> 'variants') <> 'array'
     or jsonb_array_length(payload -> 'variants') = 0 then
    raise exception 'product:variants_required';
  end if;

  -- Garante slug único acrescentando um sufixo curto se necessário
  if exists (select 1 from public.products where slug = v_slug and id is distinct from v_id) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end if;

  if v_id is null then
    insert into public.products (
      category_id, name, slug, description, badge, is_active, is_featured, is_new, position
    ) values (
      (payload ->> 'category_id')::uuid,
      payload ->> 'name',
      v_slug,
      nullif(payload ->> 'description', ''),
      nullif(payload ->> 'badge', ''),
      coalesce((payload ->> 'is_active')::boolean, true),
      coalesce((payload ->> 'is_featured')::boolean, false),
      coalesce((payload ->> 'is_new')::boolean, false),
      coalesce((payload ->> 'position')::integer, 0)
    )
    returning id into v_id;
  else
    update public.products set
      category_id = (payload ->> 'category_id')::uuid,
      name        = payload ->> 'name',
      slug        = v_slug,
      description = nullif(payload ->> 'description', ''),
      badge       = nullif(payload ->> 'badge', ''),
      is_active   = coalesce((payload ->> 'is_active')::boolean, true),
      is_featured = coalesce((payload ->> 'is_featured')::boolean, false),
      is_new      = coalesce((payload ->> 'is_new')::boolean, false),
      position    = coalesce((payload ->> 'position')::integer, 0)
    where id = v_id;
    if not found then
      raise exception 'product:not_found';
    end if;
  end if;

  -- Remove primeiro as variações que saíram (libera rótulos para reutilização)
  select coalesce(array_agg((v ->> 'id')::uuid) filter (where nullif(v ->> 'id', '') is not null), '{}')
    into v_keep
  from jsonb_array_elements(payload -> 'variants') v;

  delete from public.product_variants
  where product_id = v_id and not (id = any (v_keep));

  for v_variant in select * from jsonb_array_elements(payload -> 'variants') loop
    v_vid := nullif(v_variant ->> 'id', '')::uuid;
    if v_vid is null then
      insert into public.product_variants (
        product_id, label, price_cents, compare_at_cents, position, is_active
      ) values (
        v_id,
        v_variant ->> 'label',
        (v_variant ->> 'price_cents')::integer,
        nullif(v_variant ->> 'compare_at_cents', '')::integer,
        coalesce((v_variant ->> 'position')::integer, 0),
        coalesce((v_variant ->> 'is_active')::boolean, true)
      );
    else
      update public.product_variants set
        label            = v_variant ->> 'label',
        price_cents      = (v_variant ->> 'price_cents')::integer,
        compare_at_cents = nullif(v_variant ->> 'compare_at_cents', '')::integer,
        position         = coalesce((v_variant ->> 'position')::integer, 0),
        is_active        = coalesce((v_variant ->> 'is_active')::boolean, true)
      where id = v_vid and product_id = v_id;
      if not found then
        raise exception 'product:variant_not_found';
      end if;
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Regras de transição de status do pedido
-- Pedidos concluídos ou cancelados não podem voltar a outro status.
-- ---------------------------------------------------------------------------
create or replace function public.guard_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and old.status in ('concluido', 'cancelado') then
    raise exception 'order:status_locked';
  end if;
  if new.status = 'cancelado' and new.status is distinct from old.status
     and nullif(btrim(coalesce(new.cancel_reason, '')), '') is null then
    raise exception 'order:cancel_reason_required';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_order_status() from public, anon, authenticated;

create trigger orders_status_guard
  before update of status on public.orders
  for each row execute function public.guard_order_status();
