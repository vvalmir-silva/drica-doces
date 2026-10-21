-- Drica Doces v3.6: permite selecionar livremente o total de docinhos.
-- Aplicar APÓS 001 e 002. O servidor consulta os preços no banco e valida a soma dos sabores.
-- R$ 1,00 por doce (R$ 100,00 por cento). O preço de 50 doces permanece provisório.
update public.products
set description='Monte encomendas com 50, 100, 200, 350, 500, 1000 ou mais docinhos.',
    options='[{"id":"mixed-half","label":"Meio cento personalizado (50 docinhos)","price_cents":5000},{"id":"mixed-hundred","label":"Cento personalizado (100 docinhos)","price_cents":10000},{"id":"mixed-custom","label":"Docinhos personalizados (por unidade)","price_cents":100}]'::jsonb
where id='cento-misto';

-- 001 limitava qualquer item a 99 unidades. Apenas a opção de docinhos
-- personalizados passa a aceitar pedidos grandes; os demais itens seguem
-- com o limite anterior.
alter table public.order_items drop constraint if exists order_items_qty_check;
alter table public.order_items add constraint order_items_qty_check
  check ((option_id='mixed-custom' and qty between 50 and 100000)
     or (option_id<>'mixed-custom' and qty between 1 and 99));
