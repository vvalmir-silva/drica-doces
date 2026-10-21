-- Fases 2 e 3: agenda de produção, estoque e sinal Pix. Aplicar após 001 a 004.
-- Limite diário é um controle de capacidade compartilhado, diferente do limite de 500 doces por pedido.
alter table public.shop_settings add column if not exists daily_capacity_sweets integer not null default 1000 check(daily_capacity_sweets between 50 and 100000);
-- 0 mantém pagamento integral. Uma porcentagem >0 só passa a valer depois que a Drica a habilitar.
alter table public.shop_settings add column if not exists deposit_percent integer not null default 0 check(deposit_percent between 0 and 100);
-- A condição do sinal é fixada no momento em que o pedido é registrado; mudanças futuras não afetam pedidos antigos.
alter table public.orders add column if not exists deposit_percent integer not null default 0 check(deposit_percent between 0 and 100);

create table if not exists public.inventory_items (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 90),
 unit text not null default 'un' check(length(unit) between 1 and 16),
 quantity numeric(12,2) not null default 0 check(quantity>=0),
 min_quantity numeric(12,2) not null default 0 check(min_quantity>=0),
 unit_cost_cents integer not null default 0 check(unit_cost_cents>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.production_checks (
 order_id uuid not null references public.orders(id) on delete cascade,
 flavor_id text not null check(length(flavor_id) between 1 and 90),
 completed_qty integer not null default 0 check(completed_qty>=0 and completed_qty<=100000),
 updated_at timestamptz not null default now(),
 primary key(order_id,flavor_id)
);
create table if not exists public.notification_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 status text not null,
 email_sent boolean not null default false,
 whatsapp_sent boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists notification_events_created_idx on public.notification_events(created_at desc);

revoke all on public.inventory_items,public.production_checks,public.notification_events from anon,authenticated;
grant select,insert,update,delete on public.inventory_items,public.production_checks to authenticated;
grant select on public.notification_events to authenticated;
alter table public.inventory_items enable row level security;
alter table public.production_checks enable row level security;
alter table public.notification_events enable row level security;
create policy admin_inventory on public.inventory_items for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy admin_production on public.production_checks for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy admin_notifications on public.notification_events for select to authenticated using(public.is_shop_admin());

-- Substitui a função transacional com o mesmo contrato: checkout bloqueia o dia,
-- compara o total reservado e só então registra os itens, sem permitir sobre-reserva.
create or replace function public.create_checkout_order(p_order jsonb,p_items jsonb,p_slot_limit integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_slot text;v_code text;v_coupon text;v_day text;v_daily_cap integer;v_new_qty integer;v_existing_qty bigint;
begin
 if auth.role()<>'service_role' then raise exception 'não autorizado'; end if;
 v_slot=p_order->>'scheduled_at';v_code=p_order->>'code';v_coupon=p_order->>'coupon_code';v_day=left(v_slot,10);
 if p_slot_limit<1 or p_slot_limit>500 or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'parâmetros inválidos'; end if;
 -- Bloqueia todos os checkouts do mesmo dia antes da verificação de capacidade, evitando corrida.
 perform pg_advisory_xact_lock(hashtextextended(v_day, 8041));
 select daily_capacity_sweets into v_daily_cap from public.shop_settings where id=1;
 if v_daily_cap is null or v_daily_cap<50 then raise exception 'capacidade diária não configurada'; end if;
 select coalesce(sum(case when i.option_id='mixed-custom' then i.qty when i.option_id='mixed-half' then i.qty*50 else i.qty*100 end),0)
 into v_existing_qty from public.orders o join public.order_items i on i.order_id=o.id
 where left(o.scheduled_at,10)=v_day and o.status<>'cancelado';
 select coalesce(sum(case when x.option_id='mixed-custom' then x.qty when x.option_id='mixed-half' then x.qty*50 else x.qty*100 end),0)
 into v_new_qty from jsonb_to_recordset(p_items) as x(option_id text,qty integer);
 if v_existing_qty+v_new_qty>v_daily_cap then raise exception 'capacidade diária esgotada'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_slot, 0));
 if (select count(*) from public.orders where scheduled_at=v_slot and status<>'cancelado')>=p_slot_limit then raise exception 'horário lotado'; end if;
 if v_coupon is not null and v_coupon<>'' then
  update public.coupons set used_count=used_count+1 where code=v_coupon and active and used_count<max_uses;
  if not found then raise exception 'cupom indisponível'; end if;
 end if;
 insert into public.orders (code,client_request_id,access_hash,customer_name,customer_phone,customer_email,scheduled_at,fulfillment,cep,address,payment_method,subtotal_cents,discount_cents,delivery_fee_cents,total_cents,notes,coupon_code,status,payment_status,deposit_percent)
 values (v_code,(p_order->>'client_request_id')::uuid,p_order->>'access_hash',p_order->>'customer_name',p_order->>'customer_phone',p_order->>'customer_email',v_slot,p_order->>'fulfillment',p_order->>'cep',p_order->>'address',p_order->>'payment_method',(p_order->>'subtotal_cents')::int,(p_order->>'discount_cents')::int,(p_order->>'delivery_fee_cents')::int,(p_order->>'total_cents')::int,p_order->>'notes',v_coupon,p_order->>'status',p_order->>'payment_status',coalesce((p_order->>'deposit_percent')::integer,0)) returning id into v_id;
 insert into public.order_items(order_id,option_id,product_name,option_label,qty,unit_price_cents,extra_cents,gift_wrap,personal_message,mix_breakdown,mix_label)
 select v_id,x.option_id,x.product_name,x.option_label,x.qty,x.unit_price_cents,x.extra_cents,x.gift_wrap,x.personal_message,coalesce(x.mix_breakdown,'{}'::jsonb),coalesce(x.mix_label,'')
 from jsonb_to_recordset(p_items) as x(option_id text,product_name text,option_label text,qty integer,unit_price_cents integer,extra_cents integer,gift_wrap boolean,personal_message text,mix_breakdown jsonb,mix_label text);
 return jsonb_build_object('id',v_id);
end;$$;

revoke all on function public.create_checkout_order(jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,integer) to service_role;
