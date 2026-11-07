-- Move a checagem de admin para um schema privado, fora da API pública (RPC).
-- Aplicar somente depois de testar o painel e o checkout em homologação.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_shop_admin() from public;
grant execute on function private.is_shop_admin() to anon, authenticated, service_role;

alter policy active_products on public.products using (active or private.is_shop_admin());
alter policy admin_write_products on public.products using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy active_zones on public.delivery_zones using (active or private.is_shop_admin());
alter policy admin_write_zones on public.delivery_zones using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_write_blocks on public.blocked_dates using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_write_settings on public.shop_settings using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_orders on public.orders using (private.is_shop_admin());
alter policy admin_order_items on public.order_items using (private.is_shop_admin());
alter policy admin_payments on public.payments using (private.is_shop_admin());
alter policy admin_coupons on public.coupons using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_inventory on public.inventory_items using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_production on public.production_checks using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy admin_notifications on public.notification_events using (private.is_shop_admin());
alter policy order_revision_events_admin on public.order_revision_events using (private.is_shop_admin());
alter policy testimonials_admin_select on public.testimonials using (private.is_shop_admin());
alter policy testimonials_admin_insert on public.testimonials with check (private.is_shop_admin());
alter policy testimonials_admin_update on public.testimonials using (private.is_shop_admin()) with check (private.is_shop_admin());
alter policy testimonials_admin_delete on public.testimonials using (private.is_shop_admin());

drop function public.is_shop_admin();
