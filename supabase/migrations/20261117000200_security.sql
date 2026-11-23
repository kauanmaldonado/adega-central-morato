-- =============================================================================
-- Controle de acesso: Row Level Security (RLS) e permissões
--
-- Papéis do Supabase:
--   anon          → visitante do cardápio (chave pública)
--   authenticated → usuário logado (só é administrador se estiver em admin_users)
--   service_role  → ignora RLS; usado apenas em scripts locais, nunca no app
--
-- Regra geral: nada é acessível sem uma política explícita.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_admin(): o usuário da sessão atual é administrador?
-- SECURITY DEFINER para poder ler admin_users sem expor a tabela.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permissões de tabela (defesa em profundidade: além das políticas RLS,
-- remove privilégios que não são necessários)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.log_order_status() from public, anon, authenticated;

-- Catálogo: leitura pública; escrita só para logados (RLS restringe a admins)
grant select on public.categories, public.products, public.product_variants,
               public.product_images, public.store_settings
  to anon, authenticated;
grant insert, update, delete on public.categories, public.products,
               public.product_variants, public.product_images
  to authenticated;
grant update on public.store_settings to authenticated;

-- Dados de clientes e pedidos: nada para anon. Admins leem e atualizam.
-- Pedidos são criados SOMENTE pela função create_order().
grant select on public.customers, public.orders, public.order_items, public.order_events
  to authenticated;
grant update (name) on public.customers to authenticated;
grant update (status, delivery_fee_cents, cancel_reason) on public.orders to authenticated;

-- admin_users: o usuário logado pode consultar se ele mesmo é admin
grant select on public.admin_users to authenticated;

-- ---------------------------------------------------------------------------
-- Ativa RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.admin_users      enable row level security;
alter table public.store_settings   enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;
alter table public.customers        enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_events     enable row level security;

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
create policy "admin_users: ver o próprio registro"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- store_settings
-- ---------------------------------------------------------------------------
create policy "store_settings: leitura pública"
  on public.store_settings for select to anon, authenticated
  using (true);

create policy "store_settings: admin atualiza"
  on public.store_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create policy "categories: público vê ativas, admin vê todas"
  on public.categories for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "categories: admin cria"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));

create policy "categories: admin altera"
  on public.categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "categories: admin exclui"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy "products: público vê ativos de categorias ativas, admin vê todos"
  on public.products for select to anon, authenticated
  using (
    (select public.is_admin())
    or (
      is_active
      and exists (
        select 1 from public.categories c
        where c.id = products.category_id and c.is_active
      )
    )
  );

create policy "products: admin cria"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));

create policy "products: admin altera"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "products: admin exclui"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product_variants (visíveis se o produto for visível)
-- ---------------------------------------------------------------------------
create policy "product_variants: público vê ativas de produtos visíveis, admin vê todas"
  on public.product_variants for select to anon, authenticated
  using (
    (select public.is_admin())
    or (
      is_active
      and exists (select 1 from public.products p where p.id = product_variants.product_id)
    )
  );

create policy "product_variants: admin cria"
  on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));

create policy "product_variants: admin altera"
  on public.product_variants for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "product_variants: admin exclui"
  on public.product_variants for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product_images (visíveis se o produto for visível)
-- ---------------------------------------------------------------------------
create policy "product_images: público vê imagens de produtos visíveis, admin vê todas"
  on public.product_images for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_images.product_id)
  );

create policy "product_images: admin cria"
  on public.product_images for insert to authenticated
  with check ((select public.is_admin()));

create policy "product_images: admin altera"
  on public.product_images for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "product_images: admin exclui"
  on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- customers / orders / order_items / order_events — somente administradores
-- ---------------------------------------------------------------------------
create policy "customers: admin lê"
  on public.customers for select to authenticated
  using ((select public.is_admin()));

create policy "customers: admin altera"
  on public.customers for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "orders: admin lê"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "orders: admin altera"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "order_items: admin lê"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

create policy "order_events: admin lê"
  on public.order_events for select to authenticated
  using ((select public.is_admin()));
