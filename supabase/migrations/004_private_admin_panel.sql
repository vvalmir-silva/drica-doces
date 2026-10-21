-- DRICA DOCES PRO v3.7: proteção de pedidos e acesso administrativo.
-- Aplicar após as migrações 001, 002 e 003 no projeto Supabase.
-- NÃO autorizar anon/authenticated a ler pedidos diretamente.
revoke all on table public.orders, public.order_items, public.payments, public.coupons, public.admin_users from PUBLIC, anon;
revoke all on table public.orders, public.order_items, public.payments, public.coupons, public.admin_users from authenticated;
grant select on table public.orders, public.order_items, public.payments, public.coupons, public.admin_users to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
alter table public.admin_users enable row level security;

-- Read access is exclusively for authenticated users in admin_users.
drop policy if exists admin_orders on public.orders;
create policy admin_orders on public.orders for select to authenticated using (public.is_shop_admin());
drop policy if exists admin_order_items on public.order_items;
create policy admin_order_items on public.order_items for select to authenticated using (public.is_shop_admin());
drop policy if exists admin_payments on public.payments;
create policy admin_payments on public.payments for select to authenticated using (public.is_shop_admin());
drop policy if exists admin_coupons on public.coupons;
create policy admin_coupons on public.coupons for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());
drop policy if exists admin_self on public.admin_users;
create policy admin_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));

-- Somente pessoal autorizado pode mudar dados via painel. Alterações de status
-- são verificadas novamente pela rota do servidor /api/admin/status.
