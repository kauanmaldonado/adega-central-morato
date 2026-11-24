-- =============================================================================
-- Testes de segurança e regras de negócio do banco.
-- Executados por scripts/test-db.sh sobre um banco descartável.
-- Os registros criados aqui existem SOMENTE no banco de teste.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Utilitários de teste
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create table test.results (n serial, name text, ok boolean, detail text);
grant insert, select on test.results to anon, authenticated;
grant usage on sequence test.results_n_seq to anon, authenticated;

create function test.ok(cond boolean, name text) returns void
language plpgsql as $$
begin
  insert into test.results (name, ok) values (name, coalesce(cond, false));
end $$;

-- Executa um comando e confirma que ele FALHA com o código/mensagem esperados
create function test.fails(cmd text, name text, expected text) returns void
language plpgsql as $$
begin
  execute cmd;
  insert into test.results (name, ok, detail) values (name, false, 'não falhou');
exception when others then
  insert into test.results (name, ok, detail)
  values (name, sqlstate = expected or sqlerrm like '%' || expected || '%', sqlstate || ' ' || sqlerrm);
end $$;

grant execute on all functions in schema test to anon, authenticated;

create function test.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false);
$$;
create function test.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, false);
$$;
grant execute on all functions in schema test to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dados de teste (inseridos como superusuário)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'usuario@teste.local');
insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-00000000000a');

insert into public.categories (id, name, slug, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'Categoria ativa', 'categoria-ativa', true),
  ('10000000-0000-0000-0000-000000000002', 'Categoria inativa', 'categoria-inativa', false);

insert into public.products (id, category_id, name, slug, is_active) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Produto visível', 'produto-visivel', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Produto inativo', 'produto-inativo', false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Produto em categoria inativa', 'produto-cat-inativa', true);

insert into public.product_variants (id, product_id, label, price_cents, compare_at_cents, is_active) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Opção A', 650, 800, true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Opção B', 1000, null, true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Opção inativa', 100, null, false),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Opção de produto inativo', 100, null, true),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'Opção em categoria inativa', 100, null, true);

-- =============================================================================
-- 1. Visitante (anon)
-- =============================================================================
set role anon;
select test.as_anon();

select test.ok((select count(*) from public.categories) = 1, 'anon vê apenas categorias ativas');
select test.ok((select count(*) from public.products) = 1, 'anon vê apenas produtos ativos de categorias ativas');
select test.ok((select count(*) from public.product_variants) = 2, 'anon vê apenas variações ativas de produtos visíveis');
select test.ok((select count(*) from public.store_settings) = 1, 'anon lê as configurações da loja');
select test.ok(not public.is_admin(), 'anon não é admin');

select test.fails('select * from public.customers', 'anon não lê clientes', '42501');
select test.fails('select * from public.orders', 'anon não lê pedidos', '42501');
select test.fails('select * from public.order_items', 'anon não lê itens de pedido', '42501');
select test.fails('select * from public.admin_users', 'anon não lê administradores', '42501');
select test.fails($$insert into public.categories (name, slug) values ('X', 'x')$$, 'anon não cria categoria', '42501');
select test.fails($$update public.products set name = 'X'$$, 'anon não altera produto', '42501');
select test.fails($$delete from public.product_variants$$, 'anon não apaga variação', '42501');
select test.fails($$insert into public.orders (customer_id, fulfillment, payment_method, customer_name, customer_phone, subtotal_cents) values (gen_random_uuid(), 'retirada', 'pix', 'Fulano', '11999999999', 0)$$,
                  'anon não insere pedido direto na tabela', '42501');
select test.fails($$update public.store_settings set is_open = false$$, 'anon não altera configurações', '42501');
select test.fails($$select public.admin_save_product('{}'::jsonb)$$, 'anon não executa admin_save_product', '42501');
select test.fails($$insert into storage.objects (bucket_id, name) values ('product-images', 'products/a/b.jpg')$$,
                  'anon não envia imagem', '42501');

-- create_order: caminho feliz (o preço enviado pelo cliente é ignorado)
do $$
declare r jsonb;
begin
  r := public.create_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'Cliente Teste', 'phone', '(11) 98888-7777'),
    'fulfillment', 'entrega',
    'payment_method', 'pix',
    'address', jsonb_build_object('street', 'Rua Teste', 'number', '10', 'district', 'Centro'),
    'notes', 'teste',
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', '30000000-0000-0000-0000-000000000001', 'quantity', 3, 'price_cents', 1),
      jsonb_build_object('variant_id', '30000000-0000-0000-0000-000000000002', 'quantity', 1)
    )
  ));
  perform test.ok((r ->> 'subtotal_cents')::int = 650 * 3 + 1000, 'create_order calcula o subtotal com preços do banco');
  perform test.ok((r ->> 'code') is not null, 'create_order devolve o número do pedido');
  perform test.ok(jsonb_array_length(r -> 'items') = 2
                  and (r #>> '{items,0,unit_price_cents}')::int = 650
                  and (r #>> '{items,0,line_total_cents}')::int = 1950,
                  'create_order devolve os itens gravados com preço do banco');
end $$;

select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"119"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
                  'create_order rejeita telefone inválido', 'order:invalid_phone');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"entrega","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
                  'create_order exige endereço na entrega', 'order:address_required');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"dinheiro","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
                  'create_order rejeita forma de pagamento não aceita', 'order:payment_not_accepted');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"voando","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
                  'create_order rejeita tipo de entrega inválido', 'order:invalid_option');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000003","quantity":1}]}')$$,
                  'create_order rejeita variação inativa', 'order:item_unavailable');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000004","quantity":1}]}')$$,
                  'create_order rejeita produto inativo', 'order:item_unavailable');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000005","quantity":1}]}')$$,
                  'create_order rejeita produto de categoria inativa', 'order:item_unavailable');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":0}]}')$$,
                  'create_order rejeita quantidade zero', 'order:invalid_items');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[]}')$$,
                  'create_order rejeita pedido sem itens', 'order:invalid_items');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1},{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":2}]}')$$,
                  'create_order rejeita item repetido', 'order:duplicated_item');
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"nao-e-uuid","quantity":1}]}')$$,
                  'create_order rejeita id malformado', 'order:invalid_items');

-- Limite de 5 pedidos por telefone em 10 minutos
do $$
begin
  for i in 1..5 loop
    perform public.create_order('{"customer":{"name":"Cliente Limite","phone":"11977776666"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000002","quantity":1}]}');
  end loop;
end $$;
select test.fails($$select public.create_order('{"customer":{"name":"Cliente Limite","phone":"11977776666"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000002","quantity":1}]}')$$,
                  'create_order limita pedidos repetidos do mesmo telefone', 'order:too_many_orders');

reset role;

-- =============================================================================
-- 2. Usuário logado que NÃO é administrador
-- =============================================================================
set role authenticated;
select test.as_user('00000000-0000-0000-0000-00000000000b');

select test.ok(not public.is_admin(), 'usuário comum não é admin');
select test.ok((select count(*) from public.categories) = 1, 'usuário comum vê só categorias ativas');
select test.ok((select count(*) from public.orders) = 0, 'usuário comum não vê pedidos');
select test.ok((select count(*) from public.customers) = 0, 'usuário comum não vê clientes');
select test.ok((select count(*) from public.admin_users) = 0, 'usuário comum não vê a lista de admins');
select test.fails($$insert into public.categories (name, slug) values ('X', 'x')$$, 'usuário comum não cria categoria', '42501');
select test.fails($$select public.admin_save_product('{"variants":[{}]}'::jsonb)$$, 'usuário comum não salva produto', 'auth:forbidden');
select test.fails($$insert into storage.objects (bucket_id, name) values ('product-images', 'products/a/b.jpg')$$,
                  'usuário comum não envia imagem', '42501');

do $$
declare n int;
begin
  update public.store_settings set is_open = false;
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'usuário comum não altera configurações');
  update public.orders set status = 'confirmado';
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'usuário comum não altera pedidos');
end $$;

reset role;

-- =============================================================================
-- 3. Administrador (login com e-mail e senha)
-- =============================================================================
set role authenticated;
select test.as_user('00000000-0000-0000-0000-00000000000a');

select test.ok(public.is_admin(), 'admin é reconhecido');
select test.ok((select count(*) from public.categories) = 2, 'admin vê todas as categorias');
select test.ok((select count(*) from public.products) = 3, 'admin vê todos os produtos');
select test.ok((select count(*) from public.orders) = 6, 'admin vê os pedidos');
select test.ok((select count(*) from public.customers) = 2, 'admin vê os clientes');
select test.ok((select count(*) from public.admin_users) = 1, 'admin vê o próprio registro de admin');

insert into public.categories (name, slug) values ('Nova categoria', 'nova-categoria');
select test.ok(exists (select 1 from public.categories where slug = 'nova-categoria'), 'admin cria categoria');

select test.fails($$delete from public.categories where id = '10000000-0000-0000-0000-000000000001'$$,
                  'categoria com produtos não pode ser excluída', '23503');

-- admin_save_product: criar
do $$
declare pid uuid; n int;
begin
  pid := public.admin_save_product(jsonb_build_object(
    'category_id', '10000000-0000-0000-0000-000000000001',
    'name', 'Produto criado pelo painel', 'slug', 'produto-visivel',
    'description', 'Descrição', 'badge', '1L',
    'is_active', true, 'is_featured', true, 'is_new', false, 'position', 1,
    'variants', jsonb_build_array(
      jsonb_build_object('label', 'Pequeno', 'price_cents', 500),
      jsonb_build_object('label', 'Grande', 'price_cents', 900, 'compare_at_cents', 1100)
    )
  ));
  select count(*) into n from public.product_variants where product_id = pid;
  perform test.ok(n = 2, 'admin_save_product cria produto com variações');
  perform test.ok((select slug from public.products where id = pid) like 'produto-visivel-%',
                  'admin_save_product gera slug único quando já existe');

  -- atualizar: remove "Pequeno", altera "Grande", adiciona "Família"
  perform public.admin_save_product(jsonb_build_object(
    'id', pid,
    'category_id', '10000000-0000-0000-0000-000000000001',
    'name', 'Produto editado', 'slug', 'produto-editado',
    'variants', jsonb_build_array(
      jsonb_build_object('id', (select id from public.product_variants where product_id = pid and label = 'Grande'),
                         'label', 'Grande', 'price_cents', 950),
      jsonb_build_object('label', 'Família', 'price_cents', 1500)
    )
  ));
  perform test.ok((select string_agg(label || ':' || price_cents, ',' order by label)
                   from public.product_variants where product_id = pid) = 'Família:1500,Grande:950',
                  'admin_save_product atualiza, remove e adiciona variações');
  perform test.ok((select name from public.products where id = pid) = 'Produto editado', 'admin_save_product atualiza o produto');
end $$;

select test.fails($$select public.admin_save_product('{"category_id":"10000000-0000-0000-0000-000000000001","name":"Sem variação","slug":"sem-variacao","variants":[]}')$$,
                  'produto sem variações é rejeitado', 'product:variants_required');
select test.fails($$insert into public.product_variants (product_id, label, price_cents, compare_at_cents) values ('20000000-0000-0000-0000-000000000001', 'Preço errado', 1000, 900)$$,
                  'preço "de" menor que o preço atual é rejeitado', '23514');

-- Pedidos: status e permissões de coluna
select test.fails($$update public.orders set subtotal_cents = 1$$, 'admin não altera o subtotal do pedido', '42501');
select test.fails($$insert into public.orders (customer_id, fulfillment, payment_method, customer_name, customer_phone, subtotal_cents) values (gen_random_uuid(), 'retirada', 'pix', 'Fulano', '11999999999', 0)$$,
                  'admin não cria pedido direto na tabela', '42501');

do $$
declare oid uuid;
begin
  select id into oid from public.orders where customer_phone = '11988887777';
  update public.orders set status = 'confirmado', delivery_fee_cents = 700 where id = oid;
  perform test.ok((select total_cents from public.orders where id = oid) = 650 * 3 + 1000 + 700,
                  'total do pedido soma a taxa de entrega');
  update public.orders set status = 'concluido' where id = oid;
  perform test.ok((select count(*) from public.order_events where order_id = oid) = 3,
                  'histórico de status é registrado');
end $$;

select test.fails($$update public.orders set status = 'novo' where customer_phone = '11988887777'$$,
                  'pedido concluído não volta de status', 'order:status_locked');
select test.fails($$update public.orders set status = 'cancelado' where id = (select id from public.orders where customer_phone = '11977776666' limit 1)$$,
                  'cancelamento exige motivo', 'order:cancel_reason_required');

update public.store_settings set whatsapp_number = '5511900000000', accepted_payment_methods = '{pix,dinheiro}';
select test.ok((select whatsapp_number from public.store_settings) = '5511900000000', 'admin altera configurações');
select test.fails($$update public.store_settings set whatsapp_number = '11900000000'$$,
                  'WhatsApp sem DDI é rejeitado', '23514');

insert into storage.objects (bucket_id, name) values ('product-images', 'products/20000000-0000-0000-0000-000000000001/foto.jpg');
select test.ok(exists (select 1 from storage.objects where name like 'products/%'), 'admin envia imagem');
select test.fails($$insert into storage.objects (bucket_id, name) values ('product-images', 'outra-pasta/foto.jpg')$$,
                  'imagem fora da pasta products/ é rejeitada', '42501');

update public.store_settings set is_open = false;
reset role;

set role anon;
select test.as_anon();
select test.fails($$select public.create_order('{"customer":{"name":"Cliente","phone":"11999990000"},"fulfillment":"retirada","payment_method":"pix","items":[{"variant_id":"30000000-0000-0000-0000-000000000001","quantity":1}]}')$$,
                  'loja fechada não recebe pedidos', 'order:store_closed');
reset role;

-- =============================================================================
-- Relatório
-- =============================================================================
\set QUIET off
\pset format aligned
\pset footer off
select case when ok then 'OK   ' else 'FALHA' end as resultado, name as teste,
       case when ok then '' else detail end as detalhe
from test.results order by n;

select count(*) filter (where ok) as aprovados, count(*) filter (where not ok) as reprovados
from test.results;

do $$
begin
  if exists (select 1 from test.results where not ok) then
    raise exception 'Há testes reprovados';
  end if;
end $$;
