-- =============================================================================
-- Adega Central Morato — modelo de dados
-- Tabelas: categorias, produtos, variações (tamanho/sabor + preço), imagens,
-- clientes, pedidos, itens de pedido, histórico de status, administradores e
-- configurações da loja.
-- Valores monetários são guardados em centavos (integer) para evitar erros de
-- arredondamento.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'novo',
  'confirmado',
  'em_preparo',
  'saiu_para_entrega',
  'pronto_para_retirada',
  'concluido',
  'cancelado'
);

create type public.fulfillment_type as enum ('entrega', 'retirada');

create type public.payment_method as enum ('pix', 'credito', 'debito', 'dinheiro');

-- ---------------------------------------------------------------------------
-- Função utilitária: mantém updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administradores
-- Um usuário do Supabase Auth só tem acesso ao painel se estiver nesta tabela.
-- Linhas são criadas manualmente (SQL Editor / script), nunca pela API pública.
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Usuários do Supabase Auth autorizados a usar o painel administrativo.';

-- ---------------------------------------------------------------------------
-- Configurações da loja (linha única)
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id                       smallint primary key default 1 check (id = 1),
  store_name               text not null default 'Adega Central Morato'
                             check (char_length(store_name) between 1 and 80),
  -- Somente dígitos, com DDI 55: ex. 5511999999999
  whatsapp_number          text check (whatsapp_number ~ '^55[0-9]{10,11}$'),
  is_open                  boolean not null default true,
  opening_hours            text check (char_length(opening_hours) <= 300),
  address                  text check (char_length(address) <= 300),
  delivery_info            text check (char_length(delivery_info) <= 500),
  min_order_cents          integer check (min_order_cents >= 0),
  accepted_payment_methods public.payment_method[] not null
                             default array['pix', 'credito', 'debito']::public.payment_method[]
                             check (cardinality(accepted_payment_methods) >= 1),
  updated_at               timestamptz not null default now()
);

insert into public.store_settings (id) values (1);

create trigger store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_position_idx on public.categories (position, name);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  -- Rótulo curto exibido quando o produto não tem foto (ex.: "350ml", "5kg")
  badge       text check (char_length(badge) <= 20),
  is_active   boolean not null default true,
  is_featured boolean not null default false,  -- "Mais pedidos"
  is_new      boolean not null default false,  -- "Novidades"
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_category_idx on public.products (category_id, position, name);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Variações de produto (tamanho, sabor…) — cada uma com seu preço.
-- Uma variação está "em oferta" quando compare_at_cents > price_cents.
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  label            text not null check (char_length(btrim(label)) between 1 and 60),
  price_cents      integer not null check (price_cents between 0 and 10000000),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents > price_cents),
  position         integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (product_id, label)
);

create index product_variants_product_idx on public.product_variants (product_id, position);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imagens de produto (arquivos no bucket "product-images")
-- ---------------------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  alt          text check (char_length(alt) <= 160),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- Clientes (identificados pelo telefone)
-- ---------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 80),
  -- Somente dígitos, com DDD, sem DDI: ex. 11999999999
  phone      text not null unique check (phone ~ '^[0-9]{10,11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pedidos
-- Os dados do cliente e do endereço ficam copiados no pedido (registro
-- histórico), mesmo que o cadastro do cliente mude depois.
-- ---------------------------------------------------------------------------
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  code               bigint generated always as identity unique,
  customer_id        uuid not null references public.customers (id) on delete restrict,
  status             public.order_status not null default 'novo',
  fulfillment        public.fulfillment_type not null,
  payment_method     public.payment_method not null,
  customer_name      text not null check (char_length(customer_name) between 2 and 80),
  customer_phone     text not null check (customer_phone ~ '^[0-9]{10,11}$'),
  address_street     text check (char_length(address_street) <= 120),
  address_number     text check (char_length(address_number) <= 20),
  address_district   text check (char_length(address_district) <= 80),
  address_complement text check (char_length(address_complement) <= 120),
  notes              text check (char_length(notes) <= 500),
  subtotal_cents     integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer check (delivery_fee_cents >= 0),
  total_cents        integer generated always as (subtotal_cents + coalesce(delivery_fee_cents, 0)) stored,
  cancel_reason      text check (char_length(cancel_reason) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint orders_delivery_address_required check (
    fulfillment <> 'entrega'
    or (address_street is not null and address_number is not null and address_district is not null)
  )
);

create index orders_created_idx  on public.orders (created_at desc);
create index orders_status_idx   on public.orders (status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Itens do pedido (nome, opção e preço copiados no momento da compra)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  variant_id       uuid references public.product_variants (id) on delete set null,
  product_name     text not null,
  variant_label    text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         integer not null check (quantity between 1 and 99),
  line_total_cents integer generated always as (unit_price_cents * quantity) stored
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Histórico de status do pedido (preenchido por trigger)
-- ---------------------------------------------------------------------------
create table public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_status_history
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();
