-- Tempo máximo de acesso do painel: 8 horas a partir do login.
-- A checagem de admin passa a exigir uma sessão existente (não encerrada pelo "Sair")
-- e criada há menos de 8 horas. Vale para todas as políticas que usam private.is_shop_admin().
-- Para mudar o limite, altere o intervalo nas duas funções abaixo e em src/session.js (MAX_MS).

create or replace function private.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.admin_users a
    join auth.sessions s on s.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and s.created_at > now() - interval '8 hours'
  );
$$;
revoke all on function private.is_shop_admin() from public;
grant execute on function private.is_shop_admin() to anon, authenticated, service_role;

-- A própria consulta "sou admin?" do painel também respeita o limite.
alter policy admin_self on public.admin_users
  using (user_id = (select auth.uid()) and (select private.is_shop_admin()));

-- Usada só pelo servidor (service_role) nas rotas /api/admin/*.
create or replace function public.admin_session_valid(p_user uuid, p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.role()) = 'service_role' and exists(
    select 1
    from public.admin_users a
    join auth.sessions s on s.user_id = a.user_id
    where a.user_id = p_user
      and s.id = p_session
      and s.created_at > now() - interval '8 hours'
  );
$$;
revoke all on function public.admin_session_valid(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_session_valid(uuid, uuid) to service_role;
