-- =============================================================================
-- Login do painel apenas com e-mail e senha
--
-- Desfaz a exigência de verificação em duas etapas (código do app
-- autenticador) criada em 20261123000100_admin_mfa.sql, a pedido do dono do
-- projeto. Um usuário volta a ser tratado como administrador apenas por estar
-- na tabela admin_users — todas as políticas RLS e o armazenamento de imagens
-- continuam usando is_admin().
-- =============================================================================

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

comment on function public.is_admin() is
  'Verdadeiro para usuários logados que estão na tabela admin_users.';
