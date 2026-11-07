-- Drica Doces v4.9.1 — novo preço: R$ 150,00 o cento (R$ 1,50 por doce; meio cento R$ 75,00).
-- Já aplicado no banco de produção em 07/11/2026. Pedidos antigos mantêm o preço registrado.
update public.products
set tag='Cento por R$ 150,00',
    options=jsonb_build_array(jsonb_build_object('id',id||'-hundred','label','Cento (100 docinhos)','price_cents',15000))
where id in ('brigadeiro','beijinho','bicho-de-pe');
update public.products
set options=jsonb_build_array(
 jsonb_build_object('id','mixed-half','label','Meio cento personalizado (50 docinhos)','price_cents',7500),
 jsonb_build_object('id','mixed-hundred','label','Cento personalizado (100 docinhos)','price_cents',15000),
 jsonb_build_object('id','mixed-custom','label','Docinhos personalizados (por unidade)','price_cents',150))
where id='cento-misto';
