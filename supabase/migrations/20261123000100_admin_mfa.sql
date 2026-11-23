-- =============================================================================
-- Verificação em duas etapas obrigatória para administradores
--
-- A partir desta migration, um usuário só é tratado como administrador pelo
-- banco quando a sessão dele passou pela segunda etapa (código de 6 dígitos
-- do app autenticador). No token do Supabase isso aparece como aal = 'aal2'.
--
-- Efeito: mesmo que alguém descubra a senha de um administrador, sem o código
-- do celular dele não consegue ler pedidos, clientes nem alterar o cardápio —
-- todas as políticas RLS e o armazenamento de imagens usam is_admin().
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from public.admin_users where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

comment on function public.is_admin() is
  'Verdadeiro somente para administradores cuja sessão concluiu a verificação em duas etapas (aal2).';
