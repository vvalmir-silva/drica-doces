-- DIAGNÓSTICO SOMENTE LEITURA: execute no Supabase > SQL Editor.
-- Não cria usuários, não altera políticas e não apaga nenhum pedido.

-- 1. Verifique se há encomendas registradas no banco da loja:
SELECT COUNT(*) AS total_pedidos FROM public.orders;

-- 2. Verifique a autorização da conta administrativa (e de contas previamente autorizadas).
-- A listagem não exibe senhas, tokens nem dados de clientes.
SELECT u.email, (a.user_id IS NOT NULL) AS possui_acesso_administrativo
FROM auth.users AS u
LEFT JOIN public.admin_users AS a ON a.user_id = u.id
WHERE a.user_id IS NOT NULL OR lower(u.email) = 'drica1209@gmail.com'
ORDER BY possui_acesso_administrativo DESC, u.email;

-- 3. Confirme se as políticas de acesso continuam presentes.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('orders','order_items','admin_users')
ORDER BY tablename, policyname;

-- 4. Confirme quais tabelas auxiliares estão disponíveis.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
 AND table_name IN ('inventory_items','production_checks','notification_events','testimonials')
ORDER BY table_name;
