-- Drica Doces v4.6: executar UMA ÚNICA VEZ no banco já publicado, após 001–005.
-- Atualiza exclusivamente o catálogo atual; pedidos históricos e seus preços não são modificados.
begin;
update public.products
set tag='Cento por R$ 120,00',
    image_url=case id
      when 'brigadeiro' then '/brigadeiro.jpg'
      when 'beijinho' then '/beijinho.jpg'
      when 'bicho-de-pe' then '/bicho-de-pe.jpg' end,
    options=jsonb_build_array(jsonb_build_object(
      'id', id||'-hundred',
      'label','Cento (100 docinhos)',
      'price_cents',12000))
where id in ('brigadeiro','beijinho','bicho-de-pe');
update public.products
set options=jsonb_build_array(
 jsonb_build_object('id','mixed-half','label','Meio cento personalizado (50 docinhos)','price_cents',6000),
 jsonb_build_object('id','mixed-hundred','label','Cento personalizado (100 docinhos)','price_cents',12000),
 jsonb_build_object('id','mixed-custom','label','Docinhos personalizados (por unidade)','price_cents',120)),
 tag='Monte do seu jeito', description='Monte sua encomenda a partir de 50 doces e escolha os sabores. Acima de 500 docinhos, solicite orçamento pelo WhatsApp.', image_url='/docinhos-festa.jpg'
where id='cento-misto';

create table if not exists public.testimonials (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 60),
 rating integer not null check(rating between 1 and 5),
 message text not null check(length(trim(message)) between 15 and 600),
 consent boolean not null default false check(consent=true),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create index if not exists testimonials_published_idx on public.testimonials(created_at desc) where status='approved';
alter table public.testimonials enable row level security;
revoke all on public.testimonials from anon,authenticated;
grant select on public.testimonials to anon,authenticated;
grant insert,update,delete on public.testimonials to authenticated;
drop policy if exists testimonials_public_select on public.testimonials;
create policy testimonials_public_select on public.testimonials for select to anon,authenticated using(status='approved');
drop policy if exists testimonials_admin_select on public.testimonials;
create policy testimonials_admin_select on public.testimonials for select to authenticated using(public.is_shop_admin());
drop policy if exists testimonials_admin_insert on public.testimonials;
create policy testimonials_admin_insert on public.testimonials for insert to authenticated with check(public.is_shop_admin());
drop policy if exists testimonials_admin_update on public.testimonials;
create policy testimonials_admin_update on public.testimonials for update to authenticated using(public.is_shop_admin()) with check(public.is_shop_admin());
drop policy if exists testimonials_admin_delete on public.testimonials;
create policy testimonials_admin_delete on public.testimonials for delete to authenticated using(public.is_shop_admin());
commit;
