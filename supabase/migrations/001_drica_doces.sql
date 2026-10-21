-- Drica Doces PRO — Execute no Supabase SQL Editor do projeto da confeitaria.
-- IMPORTANTE: preços e horários iniciais são EXEMPLOS EDITÁVEIS, confirme antes de publicar.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.products (
 id text primary key default encode(gen_random_bytes(8),'hex'),
 name text not null check (length(name) between 2 and 120),
 category text not null,
 description text not null default '',
 image_url text not null default '',
 tag text not null default '',
 active boolean not null default true,
 options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
 created_at timestamptz not null default now()
);
create table if not exists public.delivery_zones (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 cep_prefix text not null unique check (cep_prefix ~ '^\d{3,8}$'),
 fee_cents integer not null check(fee_cents>=0),
 active boolean not null default true
);
create table if not exists public.blocked_dates (
 id uuid primary key default gen_random_uuid(),
 date date not null unique,
 reason text not null default ''
);
create table if not exists public.shop_settings (
 id smallint primary key default 1 check (id=1),
 min_hours integer not null default 24 check(min_hours between 0 and 720),
 max_orders_per_slot integer not null default 5 check(max_orders_per_slot between 1 and 500),
 open_time text not null default '09:00' check(open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 close_time text not null default '18:00' check(close_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 gift_wrap_cents integer not null default 300 check(gift_wrap_cents between 0 and 100000),
 allow_delivery_without_zone boolean not null default true,
 instagram_url text not null default '',
 business_hours text not null default 'Atendimento sob encomenda',
 delivery_notice text not null default 'Entrega sob consulta',
 loyalty_threshold integer not null default 5 check(loyalty_threshold between 1 and 100),
 loyalty_percent integer not null default 10 check(loyalty_percent between 1 and 100)
);
create table if not exists public.coupons (
 code text primary key check(length(code) between 4 and 24),
 percent_off integer not null check(percent_off between 1 and 100),
 min_cents integer not null default 0 check(min_cents>=0),
 max_uses integer not null default 100 check(max_uses>0),
 used_count integer not null default 0 check(used_count>=0),
 active boolean not null default true,
 customer_hash text,
 created_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 client_request_id uuid unique not null,
 access_hash text not null,
 customer_name text not null,
 customer_phone text not null,
 customer_email text,
 scheduled_at text not null check(scheduled_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
 fulfillment text not null check(fulfillment in ('Retirada','Entrega')),
 cep text,
 address text,
 payment_method text not null check(payment_method in ('Pix','Cartão no recebimento')),
 subtotal_cents integer not null check(subtotal_cents>0),
 discount_cents integer not null default 0 check(discount_cents>=0),
 delivery_fee_cents integer check(delivery_fee_cents>=0),
 total_cents integer not null check(total_cents>=0),
 notes text not null default '',
 coupon_code text,
 status text not null default 'solicitado' check(status in ('solicitado','confirmado','preparando','pronto','entregue','cancelado')),
 payment_status text not null default 'not_initiated',
 created_at timestamptz not null default now()
);
create index if not exists orders_slot_idx on public.orders(scheduled_at,status);
create index if not exists orders_phone_idx on public.orders(customer_phone);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 option_id text not null,
 product_name text not null,
 option_label text not null,
 qty integer not null check(qty between 1 and 99),
 unit_price_cents integer not null check(unit_price_cents>=0),
 extra_cents integer not null default 0 check(extra_cents>=0),
 gift_wrap boolean not null default false,
 personal_message text not null default ''
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 provider_payment_id text unique not null,
 status text not null,
 amount_cents integer not null check(amount_cents>=0),
 qr_code text,
 qr_code_base64 text,
 created_at timestamptz not null default now()
);
-- Remove permissões automáticas em dados privados; tabelas públicas têm somente leitura limitada por RLS.
revoke all on public.admin_users,public.products,public.delivery_zones,public.blocked_dates,public.shop_settings,public.coupons,public.orders,public.order_items,public.payments from anon,authenticated;
grant select on public.products,public.delivery_zones,public.blocked_dates,public.shop_settings to anon,authenticated;
grant select on public.admin_users,public.coupons,public.orders,public.order_items,public.payments to authenticated;
grant insert,update,delete on public.products,public.delivery_zones,public.blocked_dates,public.shop_settings,public.coupons to authenticated;
-- Admin order update via rota verificada no servidor (service_role). Usuários não podem escrever pedidos diretamente.

create or replace function public.is_shop_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()));
$$;
revoke all on function public.is_shop_admin() from public;
grant execute on function public.is_shop_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.shop_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy admin_self on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create policy active_products on public.products for select to anon,authenticated using(active or public.is_shop_admin());
create policy admin_write_products on public.products for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy active_zones on public.delivery_zones for select to anon,authenticated using(active or public.is_shop_admin());
create policy admin_write_zones on public.delivery_zones for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy read_blocks on public.blocked_dates for select to anon,authenticated using(true);
create policy admin_write_blocks on public.blocked_dates for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy read_shop_settings on public.shop_settings for select to anon,authenticated using(true);
create policy admin_write_settings on public.shop_settings for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy admin_coupons on public.coupons for all to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
create policy admin_orders on public.orders for select to authenticated using(public.is_shop_admin());
create policy admin_order_items on public.order_items for select to authenticated using(public.is_shop_admin());
create policy admin_payments on public.payments for select to authenticated using(public.is_shop_admin());

-- Rotina transacional: impede dois checkouts concorrentes de exceder a capacidade configurada por horário.
-- Somente a chave service_role pode executar. O servidor valida preços e endereço antes de invocá-la.
create or replace function public.create_checkout_order(p_order jsonb,p_items jsonb,p_slot_limit integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_slot text;v_code text;v_coupon text;
begin
 if auth.role()<>'service_role' then raise exception 'não autorizado'; end if;
 v_slot=p_order->>'scheduled_at';v_code=p_order->>'code';v_coupon=p_order->>'coupon_code';
 if p_slot_limit<1 or p_slot_limit>500 or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'parâmetros inválidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_slot, 0));
 if (select count(*) from public.orders where scheduled_at=v_slot and status<>'cancelado')>=p_slot_limit then raise exception 'horário lotado'; end if;
 if v_coupon is not null and v_coupon<>'' then
  update public.coupons set used_count=used_count+1 where code=v_coupon and active and used_count<max_uses;
  if not found then raise exception 'cupom indisponível'; end if;
 end if;
 insert into public.orders (code,client_request_id,access_hash,customer_name,customer_phone,customer_email,scheduled_at,fulfillment,cep,address,payment_method,subtotal_cents,discount_cents,delivery_fee_cents,total_cents,notes,coupon_code,status,payment_status)
 values (v_code,(p_order->>'client_request_id')::uuid,p_order->>'access_hash',p_order->>'customer_name',p_order->>'customer_phone',p_order->>'customer_email',v_slot,p_order->>'fulfillment',p_order->>'cep',p_order->>'address',p_order->>'payment_method',(p_order->>'subtotal_cents')::int,(p_order->>'discount_cents')::int,(p_order->>'delivery_fee_cents')::int,(p_order->>'total_cents')::int,p_order->>'notes',v_coupon,p_order->>'status',p_order->>'payment_status') returning id into v_id;
 insert into public.order_items(order_id,option_id,product_name,option_label,qty,unit_price_cents,extra_cents,gift_wrap,personal_message)
 select v_id,x.option_id,x.product_name,x.option_label,x.qty,x.unit_price_cents,x.extra_cents,x.gift_wrap,x.personal_message
 from jsonb_to_recordset(p_items) as x(option_id text,product_name text,option_label text,qty integer,unit_price_cents integer,extra_cents integer,gift_wrap boolean,personal_message text);
 return jsonb_build_object('id',v_id);
end;$$;
revoke all on function public.create_checkout_order(jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,integer) to service_role;

insert into public.shop_settings(id) values(1) on conflict(id) do nothing;
-- Fotos e valores são demonstração. Antes da abertura comercial, substitua imagens e preços.
insert into public.products(id,name,category,description,image_url,tag,active,options)values
('brigadeiro','Brigadeiro Gourmet Tradicional','Brigadeiros','Chocolate de verdade, ponto macio e uma cobertura irresistível.','https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=85','Mais amado',true,'[{"id":"brigadeiro-unit","label":"Unidade","price_cents":450},{"id":"brigadeiro-hundred","label":"Cento (100 doces)","price_cents":39000}]'::jsonb),
('beijinho','Beijinho de Coco Artesanal','Beijinhos','Coco delicado, textura que derrete e sabor de carinho.','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=85','Delicado',true,'[{"id":"beijinho-unit","label":"Unidade","price_cents":400},{"id":"beijinho-hundred","label":"Cento (100 doces)","price_cents":35000}]'::jsonb),
('cone-brigadeiro','Cone Recheado de Brigadeiro','Cones','Cone crocante e recheio cremoso com muito chocolate.','https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=85','Irresistível',true,'[{"id":"cone-brigadeiro-unit","label":"Unidade","price_cents":1390}]'::jsonb),
('cone-beijinho','Cone Recheado de Beijinho','Cones','Casquinha delicada com um recheio generoso de coco.','https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=85','Especial',true,'[{"id":"cone-beijinho-unit","label":"Unidade","price_cents":1390}]'::jsonb)
on conflict(id) do nothing;
-- O cadastro de administrador deve ser realizado MANUALMENTE no SQL Editor após criar o usuário no Supabase Auth:
-- insert into public.admin_users(user_id) values('UUID-DO-USUARIO-AUTORIZADO');
-- Nenhuma senha administrativa é embutida no código.
