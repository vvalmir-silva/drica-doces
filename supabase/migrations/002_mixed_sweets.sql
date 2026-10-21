-- Drica Doces 3.5: catálogo correto e meio cento / cento personalizável.
-- Aplica-se APÓS 001_drica_doces.sql no Supabase existente.
-- Preço do meio cento (R$ 50,00) é PROVISÓRIO, precisa de confirmação da confeitaria.
alter table public.order_items add column if not exists mix_breakdown jsonb not null default '{}'::jsonb;
alter table public.order_items add column if not exists mix_label text not null default '';

update public.products set active=false where id in ('cone-brigadeiro','cone-beijinho');
update public.products set
 name='Brigadeiro Tradicional',category='Docinhos de festa',description='Brigadeiro artesanal de festa, macio e caprichado em forminhas.',image_url='/brigadeiro.jpg',tag='Cento a R$ 100,00',active=true,
 options='[{"id":"brigadeiro-hundred","label":"Cento (100 docinhos)","price_cents":10000}]'::jsonb
where id='brigadeiro';
update public.products set
 name='Beijinho Tradicional',category='Docinhos de festa',description='Beijinho de coco artesanal, macio e delicado.',image_url='/beijinho.jpg',tag='Cento a R$ 100,00',active=true,
 options='[{"id":"beijinho-hundred","label":"Cento (100 docinhos)","price_cents":10000}]'::jsonb
where id='beijinho';
insert into public.products(id,name,category,description,image_url,tag,active,options) values
('bicho-de-pe','Bicho de Pé','Docinhos de festa','Docinho macio rosado, ideal para festas.','/bicho-de-pe.jpg','Cento a R$ 100,00',true,'[{"id":"bicho-de-pe-hundred","label":"Cento (100 docinhos)","price_cents":10000}]'::jsonb),
('cento-misto','Cento Personalizado','Docinhos de festa','Monte seu kit com 50 ou 100 docinhos.','/docinhos-festa.jpg','Monte do seu jeito',true,'[{"id":"mixed-half","label":"Meio cento personalizado (50 docinhos)","price_cents":5000},{"id":"mixed-hundred","label":"Cento personalizado (100 docinhos)","price_cents":10000}]'::jsonb)
on conflict (id) do update set name=excluded.name,category=excluded.category,description=excluded.description,image_url=excluded.image_url,tag=excluded.tag,active=excluded.active,options=excluded.options;

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
 insert into public.order_items(order_id,option_id,product_name,option_label,qty,unit_price_cents,extra_cents,gift_wrap,personal_message,mix_breakdown,mix_label)
 select v_id,x.option_id,x.product_name,x.option_label,x.qty,x.unit_price_cents,x.extra_cents,x.gift_wrap,x.personal_message,coalesce(x.mix_breakdown,'{}'::jsonb),coalesce(x.mix_label,'')
 from jsonb_to_recordset(p_items) as x(option_id text,product_name text,option_label text,qty integer,unit_price_cents integer,extra_cents integer,gift_wrap boolean,personal_message text,mix_breakdown jsonb,mix_label text);
 return jsonb_build_object('id',v_id);
end;$$;

revoke all on function public.create_checkout_order(jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,integer) to service_role;
