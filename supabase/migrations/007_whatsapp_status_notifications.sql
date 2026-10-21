-- Drica Doces v4.7 — consentimento e auditoria de avisos WhatsApp.
-- Execute APENAS depois da migração 006; não execute novamente 001 a 006.
-- Pedidos antigos continuam sem autorização automática (false).
alter table public.orders
 add column if not exists whatsapp_status_opt_in boolean not null default false;

alter table public.notification_events
 add column if not exists whatsapp_result text not null default 'not_attempted',
 add column if not exists whatsapp_message_id text,
 add column if not exists whatsapp_error_code text;

create index if not exists notification_events_order_date_idx
 on public.notification_events(order_id, created_at desc);

-- Substitui a função de checkout mantendo a mesma validação transacional da migração 005.
-- O consentimento faz parte do mesmo INSERT do pedido (sem operação posterior parcial).
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
 insert into public.orders (code,client_request_id,access_hash,customer_name,customer_phone,customer_email,scheduled_at,fulfillment,cep,address,payment_method,subtotal_cents,discount_cents,delivery_fee_cents,total_cents,notes,coupon_code,status,payment_status,deposit_percent,whatsapp_status_opt_in)
 values (v_code,(p_order->>'client_request_id')::uuid,p_order->>'access_hash',p_order->>'customer_name',p_order->>'customer_phone',p_order->>'customer_email',v_slot,p_order->>'fulfillment',p_order->>'cep',p_order->>'address',p_order->>'payment_method',(p_order->>'subtotal_cents')::int,(p_order->>'discount_cents')::int,(p_order->>'delivery_fee_cents')::int,(p_order->>'total_cents')::int,p_order->>'notes',v_coupon,p_order->>'status',p_order->>'payment_status',coalesce((p_order->>'deposit_percent')::integer,0),coalesce((p_order->>'whatsapp_status_opt_in')::boolean,false)) returning id into v_id;
 insert into public.order_items(order_id,option_id,product_name,option_label,qty,unit_price_cents,extra_cents,gift_wrap,personal_message,mix_breakdown,mix_label)
 select v_id,x.option_id,x.product_name,x.option_label,x.qty,x.unit_price_cents,x.extra_cents,x.gift_wrap,x.personal_message,coalesce(x.mix_breakdown,'{}'::jsonb),coalesce(x.mix_label,'')
 from jsonb_to_recordset(p_items) as x(option_id text,product_name text,option_label text,qty integer,unit_price_cents integer,extra_cents integer,gift_wrap boolean,personal_message text,mix_breakdown jsonb,mix_label text);
 return jsonb_build_object('id',v_id);
end;$$;

revoke all on function public.create_checkout_order(jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,integer) to service_role;
