# Drica Doces PRO v4.9 — correções da revisão de código

**O que mudou**
- **Cupons voltam a salvar no painel** (permissão corrigida na migração 008).
- **Pix renovável:** se o QR Code vencer, for cancelado ou recusado, o cliente gera um novo. Cada Pix vale 60 minutos (ajuste com `PIX_EXPIRATION_MINUTES`, 30–1440). Só existe um Pix aberto por pedido.
- **Webhook:** Pix vencido/cancelado/recusado e estornos atualizam o status de pagamento do pedido.
- **Retentativa segura:** tocar duas vezes ou perder a conexão não gera erro de "cupom inválido"; o mesmo pedido é devolvido.
- **Capacidade diária correta:** cada item grava quantos docinhos vale (`sweets_per_unit`). Opções terminadas em `-hundred` = 100, `-half` = 50, demais = 1. Para outro valor, adicione `"sweets": N` na opção do produto.
- **Privacidade:** e-mails pessoais removidos do código e da documentação. O aviso de novo pedido só é enviado se `ORDER_NOTIFICATION_EMAIL` estiver configurada na Vercel.
- **Cabeçalhos de segurança** (`vercel.json`): CSP, proteção contra o site ser embutido em outra página, HSTS, etc.
- **Site mais leve:** o painel administrativo carrega só quando aberto; bibliotecas separadas para melhor cache.

**Para atualizar**
1. Faça backup do Supabase. No **SQL Editor**, execute **somente** `supabase/migrations/008_review_fixes.sql` (depois da 007).
2. Na Vercel, confirme `ORDER_NOTIFICATION_EMAIL` (Production). Sem ela, o e-mail de novo pedido não é enviado.
3. Supabase → **Authentication → Sign In / Providers** → desative **Allow new users to sign up** (o admin já existe; ninguém mais precisa criar conta).
4. Publique (Commit + Push) e espere o deploy **Ready**.

**Testes sugeridos:** criar/editar um cupom no painel; fazer pedido com cupom e tocar duas vezes em enviar; gerar Pix, esperar vencer e gerar outro; conferir a Agenda (docinhos reservados); abrir o site e o painel e verificar que nada ficou em branco (CSP).

> Se o projeto usar domínio personalizado no Supabase (não `*.supabase.co`), adicione-o ao `connect-src` do `vercel.json`.

---

# Drica Doces PRO v4.8 — correção do carregamento do painel de pedidos

**O que foi corrigido:** a consulta das encomendas (`orders`) não depende mais do sucesso das consultas de estoque, pagamentos, notificações e depoimentos. Se uma dessas tabelas estiver ausente ou com permissão incorreta, as encomendas continuarão visíveis aos administradores autorizados, acompanhadas de um aviso específico. Itens de cada pedido são buscados separadamente; erro neles não oculta as encomendas. Erros na consulta principal aparecem em uma mensagem persistente e existe um botão `Atualizar pedidos`.

**Segurança preservada:** todas as consultas continuam usando a sessão do administrador com RLS do Supabase; nenhum acesso público à tabela `orders` foi aberto. Esta versão não requer nova migração SQL e não altera pedidos já gravados. **Execute as migrações 006 e 007 somente se ainda não as tiver aplicado.** Não repita migrações antigas sem necessidade.

**Passos para atualizar:** substitua os arquivos do seu repositório pelo conteúdo deste ZIP, faça Commit e Push no GitHub Desktop e espere o novo deployment Ready da Vercel. Abra o painel e clique em `Atualizar pedidos`. Se continuar vazio, execute as consultas somente-leitura de `DIAGNOSTICO-PAINEL.sql` no SQL Editor. Confirme se o login administrativo foi autorizado em `admin_users` e se o painel usa o mesmo projeto Supabase onde os pedidos foram gravados. Não envie as chaves privadas ou senhas para suporte.

**Teste aplicado:** testes automatizados com consultas simuladas confirmaram que pedidos permanecem visíveis quando tabelas auxiliares falham; erros reais na tabela `orders` não são mascarados como ausência de pedidos. Sintaxe dos arquivos JS/JSX conferida. **Integração ao vivo com o Supabase da sua conta e build final na Vercel ainda dependem de validação depois do deploy.**

---

# Drica Doces PRO v4.7 — WhatsApp automático nas etapas da encomenda

## O que foi implementado

- No **Painel de Gestão → Pedidos**, ao selecionar um novo status e tocar em **Salvar**, a função protegida `/api/admin/status` grava a atualização no Supabase e tenta disparar a notificação da Meta **uma única vez para aquela transição**.
- Status cobertos: **Solicitado → Confirmado → Em preparo → Pronto para retirada/entrega → Entregue**, além de **Cancelado**. O envio acontece quando o administrador altera o status (não quando o cliente apenas consulta o pedido). Repetir Salvar sem mudança não reenvia.
- A mensagem contém **nome do cliente, código e etapa do pedido** e é enviada somente para pedidos novos cujo cliente marcou voluntariamente o consentimento de WhatsApp no checkout. A caixa começa **desmarcada**.
- O painel exibe **Meta aceitou**, **sem consentimento**, **API não configurada**, **erro de conexão**, etc. Aceitação de API **não** comprova entrega ou leitura. A entrega/leitura exige webhook de status da Meta (não incluído nesta versão).
- A Drica pode **desativar** os alertas de um pedido se o cliente pedir, pelo botão **Desativar avisos deste cliente**. Não é possível ativar avisos para pedidos sem consentimento administrativamente.
- Se a API estiver indisponível, o painel mantém **Abrir conversa manual** para a Drica contatar o cliente. A atualização do status e a falha de envio ficam registradas independentemente.
- O token de acesso ao WhatsApp não vai para o navegador, GitHub nem Supabase; fica exclusivamente nas variáveis do servidor Vercel.

## Para publicar no projeto real já funcionando

1. **Faça backup do Supabase** antes de alterar o esquema.
2. Abra **Supabase → SQL Editor → New query** e execute somente a migração `supabase/migrations/007_whatsapp_status_notifications.sql`, **após** as migrações 001 a 006. O arquivo 007 preserva o histórico e acrescenta `orders.whatsapp_status_opt_in` e detalhes dos eventos em `notification_events`. Os pedidos antigos recebem `false` (não há consentimento retroativo).
3. Na [Meta for Developers](https://developers.facebook.com/apps/) e no [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/), configure uma conta do **WhatsApp Business Platform / Cloud API** apta a enviar mensagens. O número remetente deve estar associado a essa conta. O WhatsApp normal/WhatsApp Business App **sozinho não é suficiente** para habilitar a API.
4. Crie e obtenha aprovação de um **template de UTILIDADE** em português do Brasil, com **três variáveis no corpo**, exatamente nesta ordem (nome, código, status):

   `Olá {{1}}, sua encomenda {{2}} na Drica Doces foi atualizada para: {{3}}. Para acompanhar, acesse a loja e informe o código do pedido e o WhatsApp cadastrado.`

   Nome sugerido para o template: `drica_atualizacao_pedido` (use o nome e idioma exatos aprovados pela Meta).
5. No [Vercel](https://vercel.com/dashboard) → projeto `drica-doces` → **Settings → Environment Variables**, cadastre em **Production**, **somente servidor**:

   ```env
   META_WHATSAPP_TOKEN=SEU_TOKEN_DE_SERVIDOR_META
   META_WHATSAPP_PHONE_NUMBER_ID=IDENTIFICADOR_DO_NUMERO_REMETENTE
   META_WHATSAPP_TEMPLATE_NAME=drica_atualizacao_pedido
   META_WHATSAPP_TEMPLATE_LANG=pt_BR
   META_WHATSAPP_API_VERSION=v24.0
   ```

   `META_WHATSAPP_PHONE_NUMBER_ID` **não é o telefone em formato 11...**; é o identificador numérico da Meta para o telefone que envia. Use o token com permissão `whatsapp_business_messaging` e acesso ao telefone configurado. **Nunca use `VITE_`** nessas variáveis. A cobrança por mensagens de template está sujeita à tabela de preços da Meta e à categoria/país.
6. Copie os arquivos desta v4.7 para o repositório local pelo GitHub Desktop, **Commit to main → Push origin**. Espere o novo deployment **Ready** na Vercel; faça Redeploy se adicionou credenciais após publicar.
7. Faça um **novo pedido de teste** marcando o consentimento de WhatsApp. Entre no Painel de Gestão e altere a etapa para **Confirmado**. Confira no card do pedido se o resultado foi **Meta aceitou (entrega não confirmada)** e veja o registro em `public.notification_events`. Confira a entrega efetiva no WhatsApp real do cliente.

## Diagnóstico

- `no_consent`: o cliente não marcou autorização. Pedidos anteriores à migração também não estão inscritos.
- `not_configured`: faltam `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` ou `META_WHATSAPP_TEMPLATE_NAME` na Vercel.
- `api_error`: a Meta recusou o template (ex.: nome/idioma incorreto, não aprovado, número sem permissão ou token expirado). Consulte **Vercel → Logs** para o código da Meta (nunca compartilhe tokens).
- `accepted`: a API devolveu um `wamid...`. Isso **não** é confirmação de entrega. O histórico grava `whatsapp_message_id` para futura conciliação com webhook.
- `network_error`: chamada à Meta indisponível; o status do pedido continua salvo. O administrador pode usar o link manual.

### Consulta de tentativas de envio (somente pelo SQL Editor do proprietário)

```sql
select n.created_at, o.code as pedido, n.status, n.whatsapp_result, n.whatsapp_sent
from public.notification_events n
join public.orders o on o.id=n.order_id
order by n.created_at desc
limit 30;
```

**Limitação:** o disparo é feito na mesma requisição do painel; não há fila de retentativas, confirmação de entrega por webhook ou monitoramento de mensagens rejeitadas depois do aceite inicial. Para escala comercial maior, recomendamos fila/worker e webhooks autenticados. A prévia HTML não acessa autenticação ou serviços reais e não dispara WhatsApp automaticamente.

---

# Drica Doces PRO v4.6 — Preço, fotografias, contato e depoimentos

**Atualização para a loja já publicada (não refaça a instalação):**

1. Envie o conteúdo desta pasta para o repositório `drica-doces` usando GitHub Desktop → Commit → Push origin. A Vercel deverá iniciar uma nova implantação.
2. No Supabase do seu projeto, abra **SQL Editor → New query**, copie o conteúdo do arquivo **`supabase/migrations/006_prices_photos_testimonials.sql`** e clique em **Run**. **Execute somente a 006**, porque as migrações 001–005 já foram aplicadas. A 006 não modifica pedidos históricos.
3. Verifique em **Table Editor → products** que as opções agora mostram R$ 120,00 por cento e R$ 1,20 por doce no kit personalizado; R$ 60,00 para 50. **Não publique um preço novo sem aplicar a migração 006 no banco.**
4. Confirme na loja os cartões de três sabores com fotos correspondentes, link WhatsApp de contato **(11) 96082-9925**, acesso restrito no cabeçalho, depoimentos e rodapé simplificado.
5. Para comentários reais: o formulário público registra os depoimentos como `pending`; o administrador os revisa e pode aprovar ou retirar no painel, aba **Depoimentos**. Sem o SQL 006 esse recurso não funcionará.

**Formulário de contato:** prepara a mensagem do cliente e abre o WhatsApp. O cliente confirma o envio dentro do WhatsApp. Não é um formulário de e-mail nem grava mensagens no banco.

**Fotos ilustrativas:** as três fotos estão separadas por sabor, mas devem ser substituídas por fotos próprias da Drica quando possível.

**Conta administrativa:** contas reais são criadas exclusivamente pelo **Supabase → Authentication → Users**. Depois autorize o UUID do usuário em `public.admin_users`. Não há login ou senha padrão no ZIP. Use senha nova e forte, que não tenha sido compartilhada em mensagens. Nunca inclua senhas e chaves em arquivos do GitHub.

**Testes:** prévia HTML testada em cinco larguras de tela, conferência dos valores e análise sintática JSX/JavaScript concluídas. O build React integral não foi executado neste ambiente por falta de acesso ao registro npm; confirme o resultado no Deploy da Vercel. Integrações Supabase e notificações exigem validação no servidor publicado.

---

> **v4.5 — Novo WhatsApp de atendimento e pedidos: (11) 96082-9925.** Para atualizar a loja publicada, envie os arquivos alterados ao GitHub e aguarde um novo deploy na Vercel. O WhatsApp abre com a mensagem pronta; o cliente confirma o envio dentro do aplicativo.

# Drica Doces PRO v4.4 — WhatsApp após registro do pedido

Correção para o site publicado na Vercel, com Supabase configurado:

- Ao tocar em **Registrar encomenda e abrir WhatsApp**, primeiro o sistema registra o pedido no servidor. **Somente se o registro for bem-sucedido**, abre o WhatsApp na mesma aba com a mensagem preparada para **(11) 96082-9925**.
- O cliente ainda precisa tocar em **Enviar** dentro do WhatsApp. O site **não envia mensagens automaticamente**; isso exigiria a API oficial do WhatsApp Business e aprovação.
- O pedido continua com status **solicitado** no banco de dados, mesmo que o cliente não envie a mensagem no WhatsApp.
- O carrinho é limpo antes de sair. Um link direto de **Abrir WhatsApp novamente** permanece na confirmação caso a abertura automática falhe.
- Corrigido aviso de atributo `aria-live` duplicado em `MixedSweetBuilder.jsx`.
- Atualizada a chave de cache do service worker, para facilitar substituição da versão antiga.

## Atualizar o site já publicado

1. Extraia este ZIP e copie **todo o conteúdo** para a pasta local do repositório `drica-doces` já clonado com GitHub Desktop, substituindo arquivos.
2. No GitHub Desktop, clique em **Commit to main** e depois **Push origin**.
3. A Vercel deverá implantar automaticamente o novo commit. Confira em **Deployments** se está **Ready**.
4. Faça um novo pedido de teste, abra o WhatsApp, confira o número **(11) 96082-9925** e toque em **Enviar** para mandar a mensagem.
5. Verifique a tabela `public.orders` e o código do pedido. **Não execute novamente as migrações SQL**; esta atualização altera somente o front-end e a chave de cache.

> Se seu navegador bloquear a abertura automática, use o botão **Abrir WhatsApp novamente** na tela de confirmação. O registro do pedido e a entrega da mensagem no WhatsApp são operações distintas.

---

# Drica Doces PRO v4.3 — imagem de brigadeiro no destaque

- O destaque superior agora usa fotografia de brigadeiro tradicional obtida do Wikimedia Commons; a URL externa é usada **somente para esta fotografia**.
- A demonstração HTML inclui imagem local ilustrativa de reserva, para não exibir fundo marrom vazio se a foto externa estiver indisponível.
- O projeto React usa `public/docinhos-festa.jpg` como reserva offline.
- Crédito da fotografia: **Mayra (Maych)**, [Brigadeiro.jpg no Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Brigadeiro.jpg), licença [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). A fotografia é mostrada com recorte de enquadramento CSS na área do destaque.
- Imagem ilustrativa; não é uma foto dos produtos reais da Drica Doces.

---

# Drica Doces PRO v4.1 — Fases 2 e 3 (agenda, produção, financeiro e Pix)

**Versão demonstrativa:** `PREVIA-SEM-BACKEND.html` também está disponível isoladamente como `drica-doces-pro-v4.1-demo.html`. Funciona no navegador do celular para montar pedidos e consultar a **capacidade simulada do próprio aparelho**. O painel de gestão permanece BLOQUEADO na demonstração porque dados privados exigem autenticação real. Não use esta prévia para receber pedidos comerciais.

## Fase 2 — Agenda e produção

- **Agenda administrativa por data:** pedidos do dia, unidades reservadas, disponibilidade aproximada e quantidade a produzir por sabor, incluindo misturas personalizadas.
- **Capacidade diária configurável:** padrão inicial de **1.000 docinhos/dia** (apenas referência editável; ajuste à produção real). O cliente ainda consulta pelo WhatsApp quando deseja **mais de 500 docinhos em um único pedido**, conforme combinado.
- **Validação transacional no banco:** `005_phases_2_3.sql` acrescenta uma trava por dia no `create_checkout_order` para evitar sobre-reserva quando várias pessoas finalizam simultaneamente. O limite por horário da versão anterior continua.
- **Disponibilidade pública agregada:** rota `POST /api/availability` divulga apenas quantidades disponíveis, nunca nomes, telefones ou pedidos individuais. O checkout confere novamente no servidor.
- **Checklist de produção:** a Drica registra quantos doces de cada sabor foram preparados por encomenda; a informação fica em `production_checks` com RLS administrativo.
- **Estoque de ingredientes:** cadastro, unidade, quantidade, mínimo e custo unitário, com alerta de baixo estoque. A saída de estoque **não é automática**, porque receitas e consumo por doce não foram cadastrados.
- **Bloqueio de datas:** mantém o calendário existente da loja.

## Fase 3 — Pagamentos e comunicações

- **Financeiro privado:** pedidos registrados, valores aprovados pelo Mercado Pago, valores pendentes, filtro de mês e histórico de tentativas de notificação. Não confunda total encomendado com caixa recebido ou lucro; os relatórios carregam até os **100 pedidos recentes**, sem paginação histórica.
- **Sinal Pix configurável:** `deposit_percent` de 0 a 100 no painel. **Padrão 0% (desativado; cobra o valor integral somente quando a Drica confirmar).** A porcentagem é fixada em `orders.deposit_percent` ao registrar o pedido, evitando alterar encomendas anteriores.
- **Pagamento após confirmação:** para encomendas com Pix e status confirmado, o cliente entra em **Meu pedido**, informa código + WhatsApp cadastrado e CPF, e solicita QR Code. Exige Mercado Pago configurado em servidor HTTPS. Não armazenamos CPF no pedido.
- **Webhook de pagamento:** confirma informações com o Mercado Pago; se houve somente sinal, status `deposit_paid`; caso integral, `approved`. Os avisos de pagamento não são enviados duas vezes no mesmo evento aprovado. Saldo do sinal deve ser combinado com a confeitaria; **não existe cobrança automática do saldo nesta versão**.
- **Notificações de status:** rota administrativa preservada. Pode enviar e-mail (Resend) e template previamente aprovado (Meta WhatsApp Business API), registrando `email_sent` e `whatsapp_sent` em tabela privada. O registro indica que a API aceitou a solicitação, não entrega/leitura do aviso.
- **Segurança:** não há senha padrão nem chave secreta incluída no ZIP. As consultas e alterações do painel exigem Supabase Auth, associação em `admin_users` e RLS. O rate-limit do servidor requer Upstash Redis.

## Instalar e publicar as Fases 2 e 3

1. Descompacte o ZIP e instale `npm install`; execute `npm run dev` para o front-end e `npm run build` antes de publicar. A instalação **não foi executada com sucesso neste ambiente** porque a dependência `@supabase/supabase-js` não está disponível no cache offline. Checagens estáticas dos arquivos JS/JSX foram realizadas.
2. No Supabase, aplique **na ordem** as migrações `001`, `002`, `003`, `004` e **`005_phases_2_3.sql`**. Se o projeto já usa as quatro primeiras, aplique apenas `005`. **Faça backup e teste a migração primeiro em homologação.** Cadastre o usuário em Supabase Auth e autorize seu UUID na tabela `admin_users` usando conta privilegiada.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend; configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PUBLIC_SITE_URL` somente no servidor conforme `.env.example`. Nunca exponha a chave service_role.
4. Em **Painel de Gestão → Configurações**, ajuste a capacidade de docinhos por dia, os limites por horário e opcionalmente o sinal Pix. Em **Agenda/Produção/Estoque**, cadastre e gerencie os dados reais.
5. Para **cobrar de verdade**, configure `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e o webhook `https://SEU-DOMINIO/api/webhooks/mercadopago`. Verifique o webhook com pagamentos de teste e conciliação antes de usar em produção. Configure **Resend e Meta Business API** separadamente para notificações; a prévia HTML não envia mensagens automaticamente.
6. Faça testes com duas encomendas simultâneas no mesmo dia perto do limite, datas bloqueadas, login não autorizado, consulta do cliente, pagamento parcial aprovado e webhook duplicado antes de operar comercialmente.

**Preços e disponibilidade:** referências de preço exibidas ainda precisam de confirmação da confeitaria (especialmente meio cento e mistura de sabores). O botão WhatsApp **abre a conversa com texto preparado**, mas não confirma envio até o cliente tocar em Enviar.

## Verificações feitas nesta entrega

- `npm run check`: passou para as rotas JavaScript, incluindo `/api/availability`.
- Análise de sintaxe JSX/JS dos componentes React via TypeScript transpileModule: passou.
- Teste Chromium da **prévia HTML** em cinco larguras (320, 375, 430, 768 e 1.280 px), incluindo seleção, capacidade demonstrativa, registro local e carrinho zerado: passou.
- **Não testado em serviços reais:** Supabase, autenticação, banco PostgreSQL, Mercado Pago, Webhooks, Meta/Resend e envio efetivo de WhatsApp.

---

# Drica Doces PRO v4.0 — Fase 1: segurança e confiabilidade

## O que foi atualizado

- **Painel de gestão:** continua exigindo autenticação Supabase e inclusão do usuário em `public.admin_users`. Não existe senha padrão. Adicionadas busca de pedidos por código/cliente e filtragem por status. Consultas de todos os pedidos são feitas exclusivamente por contas administrativas autorizadas; a prévia HTML não possui login administrativo real.
- **Cliente:** acompanhamento individual pelo código + WhatsApp do pedido. Alterar o código/telefone na consulta esconde imediatamente a resposta anterior, evitando revelar acidentalmente dados de outra consulta.
- **Configurador:** botão **Zerar seleção**, preço por sabor, cálculo instantâneo e valor inicial R$ 0,00.
- **Pedido por WhatsApp:** após registrar a solicitação, a prévia limpa carrinho, quantidades, preço e formulário antes de sair para o WhatsApp. Não salva código e telefone automaticamente nos campos públicos de acompanhamento. Mostra um aviso de solicitação com código copiável antes do redirecionamento; no React, o código tem botão para copiar antes de abrir o WhatsApp.
- **Pedidos de festa:** mantidos os 3 sabores, o WhatsApp `(11) 96082-9925`, mínimo de 50 docinhos e atendimento especial acima de 500 unidades.
- **PWA:** identificador de cache estático incrementado para `drica-static-v400`.

## Segurança e implantação

**Atenção: a prévia HTML é uma simulação local**, com histórico de testes guardado exclusivamente no navegador. Não use pedidos de clientes reais nela; o histórico local não é um banco compartilhado e não oferece autenticação adequada. O painel administrativo fica bloqueado sem backend.

Para operar comercialmente: configurar Supabase Auth e Postgres com as migrações SQL `001` a `004` na ordem; criar uma conta no Auth e adicionar o `user_id` correspondente à tabela `public.admin_users` por uma operação autorizada no Supabase; configurar as variáveis `.env.example`, as APIs do Vercel e a proteção por rate limit. Testar login, permissão RLS, pedido, consulta por código+WhatsApp e envio antes do deploy.

O botão do WhatsApp **abre a conversa com texto preparado**, mas **não pode confirmar o envio** por conta própria. Pix, avisos automáticos e produção com bancos externos dependem de credenciais e serviços. A versão HTML é apenas para experimentação.

## Validação desta versão

- Verificação de sintaxe JavaScript da prévia e das rotas de API com Node.
- Análise de sintaxe JSX de `App.jsx`, `MixedSweetBuilder.jsx`, `GuidedCheckout.jsx`, `LargeOrderModal.jsx` com TypeScript transpileModule.
- Testes de responsividade e interação na prévia Chromium nas larguras 320, 375, 430, 768 e 1280 px: seleção inicial zerada, incrementos, valores por sabor e botão de zerar; sem rolagem horizontal.
- **Pendente:** build React completo com `npm install` (dependências indisponíveis neste ambiente) e testes de autenticação/pagamento em um projeto Supabase real.

## Próximas fases sugeridas

**Fase 2 — Gestão e agenda:** ampliar capacidade por dia, reservar janelas de produção, calendário, painel de produção e estoque.

**Fase 3 — Pagamentos e automação:** sinal via Pix com integração em produção, mensagens de status via WhatsApp Business API e relatórios financeiros. Nem o Pix nem o envio automático operam na prévia local.

---

# Drica Doces PRO v3.13

## Regra atualizada na v3.13

- Foram removidos os atalhos de 500 e 1.000 doces do configurador. A quantidade continua podendo ser digitada manualmente.
- **Até 500 docinhos (inclusive):** pedido normal. **501 ou mais:** pop-up de consulta pelo WhatsApp (11) 96082-9925, com data e horário desejados.
- O limite considera **a soma de unidades de docinhos de todos os kits no carrinho**, não somente o valor em reais. O preço-base anterior de R$ 100,00 por 100 unidades continua ilustrado.
- A regra também é validada no endpoint de criação de pedidos (para o sistema publicado com backend).
- A versão HTML continua sendo uma demonstração local. Para publicar com banco de dados e administração, é necessário configurar e testar o Supabase.

# Evolução a partir da v3.12

## Novidade

- Removido o atalho de **500 doces / R$ 500,00** do configurador.
- Para **encomendas acima de 500 docinhos** (soma das unidades de todos os kits), o cliente é direcionado a uma consulta especial com pop-up e botão para WhatsApp **(11) 96082-9925**.
- O pop-up exibe uma mensagem de boas-vindas, a quantidade e a composição dos sabores, permite informar **data e horário desejados (opcionais)** e prepara uma mensagem no WhatsApp solicitando a disponibilidade de produção, o melhor horário e orçamento. A mensagem só é enviada quando o cliente confirma dentro do WhatsApp.
- Para pedidos especiais o configurador mostra **Valor sob consulta**, sem presumir que a Drica aceitará o pedido ou manterá o preço proporcional.
- A aplicação bloqueia tentativas de registrar quantidades acima do limite no checkout React, na simulação local e no endpoint `api/orders/create.js`.
- Pedidos **até e incluindo 500 docinhos** seguem o checkout normal; a opção de 500 doces só foi removida dos **atalhos**, podendo ser informada manualmente.
- O pop-up de consulta não cria pedido nem apaga o carrinho, porque nenhuma encomenda foi formalmente registrada. A limpeza completa após o envio de um pedido normal continua como na v3.11.
- A demonstração funciona localmente com dados persistidos apenas no aparelho. O login administrativo real e as integrações de pagamento requerem configuração do Supabase/servidor.

---

# Drica Doces PRO v3.11 — limpeza completa após WhatsApp

Quando o cliente abre o WhatsApp a partir da encomenda, limpa-se carrinho, seleção de sabores, quantidade total, preço, multiplicador de kits e formulário, mantendo o histórico de encomendas para consulta por código e telefone. No React, o configurador é remontado após a limpeza; na prévia, o estado JS e os inputs são explicitamente zerados antes da navegação.

# Drica Doces PRO v3.10 — quantidade inicial zerada

- O configurador começa com 0 docinhos, todos os sabores em 0 e o valor de R$ 0,00.
- Ao digitar a quantidade total ou alterar um sabor pelos botões +/−, total e valor são atualizados imediatamente.
- O botão para adicionar ao carrinho só libera para pedidos válidos a partir de 50 doces; o preço indicado mantém R$ 100,00 por 100 doces, proporcional à quantidade.
- As regras de pedido, contato WhatsApp e painel privado permanecem as da versão anterior.

# Drica Doces PRO v3.9 — correção de carrinho e checkout

**Correção:** após tocar em **Enviar pedido via WhatsApp**, a prévia e o React zeram o carrinho, limpam o formulário, retornam ao passo Carrinho e só depois iniciam a abertura do WhatsApp. A limpeza é persistida no `localStorage` imediatamente e revalidada quando o navegador retorna do WhatsApp (evento `pageshow`).

Esta versão utiliza chaves novas (`drica-demo-cart-v39` e `drica-cart-v39`) e descarta os carrinhos antigos presos na versão anterior, **preservando** os registros para acompanhamento pelo código. O pedido registrado não é apagado.

**Envio:** a mensagem é aberta para **(11) 96082-9925**, mas o cliente precisa tocar em Enviar dentro do WhatsApp. A loja não consegue confirmar que a mensagem foi enviada.

# Drica Doces PRO v3.8 — Carrinho zerado após abrir WhatsApp

- No checkout da demonstração, assim que o pedido é preparado e o WhatsApp é aberto, o carrinho e a chave `drica-demo-cart-v1` do armazenamento local são esvaziados **sincronamente**, antes de sair da página.
- No projeto React, a limpeza ocorre ao tocar em **Enviar pedido via WhatsApp**, removendo imediatamente `drica-cart-v2` e zerando o estado do carrinho.
- Os registros já criados para acompanhamento do pedido **não** são apagados.
- Na demonstração, o link alternativo da mensagem fica visível mesmo depois da limpeza do carrinho, caso o navegador bloqueie o WhatsApp.
- O site não consegue verificar se o cliente tocou em **Enviar** dentro do aplicativo WhatsApp. O carrinho é zerado quando o usuário aciona a abertura do WhatsApp, não após confirmação de entrega da mensagem.

---

# Drica Doces PRO v3.7 — Área de gestão restrita e privacidade dos pedidos

**Alterações desta versão:**

- O painel administrativo não tem mais acesso irrestrito na demonstração: o modo HTML e o modo React sem backend mostram **acesso bloqueado**. Não é seguro criar uma senha fixa no JavaScript ou no HTML.
- No ambiente publicado, administradores precisam entrar com **usuário (e-mail) e senha do Supabase Auth**, e estar cadastrados em `public.admin_users` para consultar pedidos, dados de clientes e atualizar a loja.
- O cliente acessa apenas **o andamento do próprio pedido** usando código de encomenda **e** WhatsApp cadastrado. Não existe lista pública de pedidos. A rota `/api/orders/track` consulta e retorna apenas código, status, data, forma de recebimento, pagamento e total, sem dados de outros clientes.
- Aplique também `supabase/migrations/004_private_admin_panel.sql` para reafirmar os privilégios privados e as políticas RLS da base de dados.
- Na demonstração local, pedidos de teste permanecem no armazenamento do próprio navegador; **isso não oferece isolamento seguro entre pessoas que compartilham o mesmo aparelho**. Para pedidos reais, publique com banco de dados, autenticação e APIs configurados.

**Configuração do administrador:** Supabase Dashboard → Authentication → Users → crie a conta com e-mail e senha forte; copie o ID/UUID da conta e execute no SQL Editor:

```sql
insert into public.admin_users (user_id) values ('UUID-DA-CONTA-ADMIN') on conflict (user_id) do nothing;
```

Não há usuário nem senha administrativa padrão no projeto. No modo de produção, nunca coloque `SUPABASE_SERVICE_ROLE_KEY` ou senhas em arquivos públicos.

---

# Atualização v3.6.2 — WhatsApp de pedidos

O destino de todos os links de pedido e contato da loja foi alterado para **(11) 96082-9925** (`5511960829925`). Na prévia HTML, o botão **Enviar pedido via WhatsApp** agora abre diretamente uma nova aba/conversa com o pedido preenchido e mantém o link manual como alternativa se o navegador bloquear a abertura. No React, o botão usa o mesmo destino configurado. **O cliente precisa confirmar o envio dentro do WhatsApp**; o site sozinho não consegue mandar mensagens automaticamente.

# Drica Doces PRO v3.6.1

Ajuste aplicado:
- ao clicar em + ou − na quantidade dos doces do configurador, o total e o valor são atualizados automaticamente.

# Drica Doces PRO v3.6 — encomendas para festas de qualquer tamanho

- O cliente informa o total desejado a partir de 50 unidades (ex.: 150, 350, 500, 1.000 ou 5.000), sem o antigo limite de 100.
- Divide exatamente a quantidade entre os sabores. O site mostra o que falta ou excede.
- O preço mostrado é proporcional ao cento de R$ 100,00 (R$ 1,00 por doce); o valor do meio cento continua **provisório** e precisa ser confirmado com a confeitaria.
- Cada composição personalizada fica numa linha separada no carrinho; aumentar/diminuir essa linha é feito removendo e remontando o pedido, para manter as quantidades consistentes.
- O servidor confirma a quantidade e recalcula o total com o preço do banco; limite técnico por linha de 100.000 unidades e por encomenda de R$ 100.000,00, sujeito a disponibilidade de produção.
- Para publicar esta atualização, aplicar SQL `supabase/migrations/003_unlimited_party_orders.sql` após as migrações anteriores.

# Drica Doces PRO v3.5 — Personalização de 50 ou 100 doces

O configurador permite escolher **meio cento (50 docinhos)** ou **cento (100 docinhos)**, com botões rápidos de 25 em 25, composição escolhida no carrinho e no WhatsApp. Também aceita vários kits de composições diferentes.

**Valores:** R$ 100,00 o cento (informado pela confeitaria). R$ 50,00 o meio cento é uma **estimativa proporcional, ainda não confirmada**. Ajuste o preço no catálogo antes de aceitar pedidos reais.

**Sabores disponíveis inicialmente:** brigadeiro, beijinho e bicho de pé. Novos sabores devem ser cadastrados como produtos ativos na categoria `Docinhos de festa` no painel administrativo. O configurador os disponibiliza automaticamente; não publicamos sabores inexistentes.

**Publicação:** execute as migrações 001 e 002 em ordem (ou aplique só 002 em um banco já inicializado com 001), configure as variáveis no `.env.example`, instale dependências e valide o build antes de publicar. É necessária implantação com Supabase e as APIs serverless para persistir a composição e enviar alertas, e serviços de pagamento/WhatsApp têm configuração própria. A prévia HTML guarda pedidos apenas no navegador, sem Pix ou notificações reais.

# Drica Doces PRO v3.4

Novidade principal:
- cento personalizado com escolha da quantidade de brigadeiro, beijinho e bicho de pé, totalizando 100 docinhos;
- composição exibida no carrinho e no WhatsApp.

# Drica Doces PRO v3.3

Atualização aplicada:
- nomes e descrições comerciais dos doces revisados;
- popup do produto com visual mais elegante;
- seção especial de cento misto adicionada;
- cardápio principal mantido com brigadeiro, beijinho e bicho de pé.

# Drica Doces PRO v3.2

Atualização aplicada:
- Mantidos apenas 3 doces no cardápio: brigadeiro, beijinho e bicho de pé.
- Cada doce possui imagem separada.
- Valor de exibição configurado para R$ 100,00 o cento.
- Ao clicar na imagem ou no botão do card, abre o popup com as informações do doce.

# Drica Doces PRO v3.1

Atualização aplicada:
- Brigadeiro e beijinho ajustados como docinhos de festa.
- Foto de referência de docinhos incluída no projeto.
- Preço do cento de brigadeiro: R$ 100,00.
- Preço do cento de beijinho: R$ 100,00.

# Drica Doces PRO — v3.0

**Site de encomendas mobile-first em português (React 18 + Vite + Tailwind CSS + Lucide React)** e backend preparado para **Supabase (Auth, Postgres, RLS)**, **Vercel Functions**, **ViaCEP**, **Resend**, **Mercado Pago Pix**, **Meta WhatsApp Cloud API (opcional)** e **PWA**.


## Atualização v3.0 — Checkout em 3 etapas e frete confirmado (20/10/2026)

A loja React agora usa `src/GuidedCheckout.jsx`, um checkout mobile-first em **três etapas**:

1. **Carrinho:** conferência de produtos, quantidades e personalização; incremento/decremento, exclusão e retorno ao catálogo. O carrinho vazio impede qualquer avanço, pagamento ou geração de pedido.
2. **Entrega:** nome, telefone, e-mail, data e horário, retirada/entrega, busca automática de CEP via ViaCEP. Mostra a taxa de entrega da região cadastrada no painel, ou um botão de **consulta de frete pelo WhatsApp (11) 96082-9925** quando o CEP ainda não possui tarifa.
3. **Confirmação:** revisão de itens, quantidades, data, endereço, subtotal, taxa, cupom, total previsto e pagamento preferido. O cliente pode voltar e corrigir dados; só registra uma solicitação após concluir a conferência. A tela final mostra o código do pedido e o botão para abrir o WhatsApp com texto pronto; o cliente precisa tocar em **Enviar** no WhatsApp.

**Integridade comercial:** entregas sem tarifa cadastrada são barradas **também** em `api/orders/create.js`, bem como no cálculo da demo em `src/api.js`; `allow_delivery_without_zone` é mantido no schema por compatibilidade, mas não autoriza checkout sem preço de frete. Se o CEP não for atendido, o cliente consulta pelo WhatsApp ou seleciona retirada. A taxa cadastrada é exibida antes de seguir para pagamento. O servidor continua recalculando todos os preços e validando cupons em produção. No React conectado, o valor do cupom é validado ao registrar a encomenda e o total definitivo é mostrado antes de gerar um Pix.

**Prévia HTML independente:** `PREVIA-SEM-BACKEND.html` também apresenta as três etapas e a tela de revisão, com frete conforme as regras de exemplo (sem painel administrativo aberto ao público). Não há cobrança real, e-mail real ou autenticação nessa prévia. Para testar o frete real, configure uma região no Supabase usando a conta administrativa no projeto publicado.

**Fotos reais:** ainda não foram fornecidas pela confeitaria; continuam sendo imagens ilustrativas de terceiros. Troque pela fotografia real de cada doce na aba **Produtos** do painel. Confirme também todos os preços antes da publicação.

### Validação v3.0

- Sintaxe React JSX validada via transpiler TypeScript para `src/App.jsx` e `src/GuidedCheckout.jsx`; sintaxe JavaScript do servidor validada com `npm run check`.
- Testes funcionais da **prévia HTML** em Chromium via Playwright, viewport **320, 375, 430, 768 e 1280 px**, sem rolagem horizontal ou erros JS observados: carrinho vazio, edição, validação, etapas de entrega, bloqueio para CEP sem frete e remoção do último item.
- Teste de ponta a ponta **apenas na prévia HTML local**, com taxa de demonstração de **R$ 7,00** cadastrada para prefixo `010`: revisão do frete, pedido local e geração de link WhatsApp para `5511960829925` com o resumo correto.
- `npm install --offline` **não concluiu**, porque `@supabase/supabase-js` não estava no cache. Portanto, build React, teste de integração real, e-mails, pagamento Pix, Supabase e deploy **não foram executados** neste ambiente.

---

## Atualização v2.1 — Bloqueio de checkout e responsividade (20/10/2026)

**Regra obrigatória:** nenhuma pessoa pode escolher forma de pagamento, criar uma solicitação ou ir para o checkout sem ao menos um item válido de preço positivo no carrinho.

- **Carrinho vazio:** o botão "Finalizar encomenda" fica desabilitado e a gaveta exibe a orientação "Adicione pelo menos um doce" e um atalho para o cardápio.
- **Acesso direto pelo menu:** quando não há produtos, o link "Encomendar" no React redireciona ao cardápio com aviso. Caso o cliente role manualmente até a seção de checkout, verá **um estado vazio**, nunca os campos de pagamento.
- **Adicionar/remover:** o checkout reaparece ao adicionar um doce e desaparece imediatamente ao retirar o último item. No envio, há uma segunda checagem; o servidor também recusa carrinhos sem itens (rota `api/orders/create.js`).
- **Pedido já registrado:** a tela de confirmação e o Pix de um pedido legítimo continuam acessíveis após o carrinho ser limpo; isso não equivale a iniciar um checkout vazio.
- **Celular:** o resumo da finalização aparece antes do painel explicativo; cardápio em uma coluna nos aparelhos muito estreitos, botões de quantidade maiores, carrinho flutuante compacto, adaptação à área segura da tela e espaçamento inferior para o botão fixo.
- **Prévia HTML:** inclui a mesma regra de carrinho vazio e mensagens claras. O formulário de pagamento fica oculto enquanto o carrinho não tiver produtos. A prévia é local; não gera Pix nem envia e-mail real.

**Verificações realizadas:** análise sintática JSX do React (`tsc`), `npm run check` nas rotas de servidor e teste funcional da **prévia HTML** em Chromium, com viewport de **320, 375, 430, 768 e 1280 px**. Foram testados bloqueio inicial, navegação, adição, liberação, remoção do último produto e ausência de rolagem horizontal. Esses testes **não substituem** `npm run build`, a validação visual no celular físico, o teste end-to-end da aplicação React e os testes em serviços reais.

### Melhorias recomendadas para próximas etapas

1. Fotografias reais e otimizadas dos doces e preços definitivos, com formatos modernos e imagens sob demanda.
2. Indicador de progresso no checkout (`Carrinho → Entrega → Confirmação`) e revisão da encomenda antes do envio ao WhatsApp.
3. Confirmação de estoque, horário de retirada e taxa de entrega antes de iniciar o Pix.
4. Medição de conversão por etapa, sem rastreamento excessivo de dados pessoais; consentimento e privacidade conforme LGPD.
5. Testes automatizados end-to-end para React com Playwright, incluindo iOS/Android reais, navegação por teclado e acessibilidade WCAG.

## O que foi implementado

- Layout premium rosa-bebê, creme e marrom-chocolate, navegação responsiva, cards e fotografias ilustrativas, catálogo por categorias.
- Quatro doces: Brigadeiro Gourmet e Beijinho (unidade/cento), Cone Recheado de Brigadeiro e Cone de Beijinho (unidade).
- Carrinho lateral (persistido no navegador), quantidades, remoção, opção de embalagem para presente e mensagem especial por doce.
- Checkout para retirada/entrega com ViaCEP, hora/data, campo de cupom, Pix ou cartão no recebimento, observações, WhatsApp **(11) 96082-9925**.
- Consulta por código de pedido + telefone, com status recebido/confirmado/preparando/pronto/entregue/cancelado e acompanhamento do pagamento.
- Painel administrativo: gestão de pedidos, edição/cadastro de doces e preços, fotos por URL, cupons, regiões por prefixo de CEP/taxas, bloqueio de datas, antecedência mínima, capacidade de agendamento, embalagem, Instagram, horários e fidelidade.
- Registro de pedidos **no servidor com validação de preços**, bloqueio de concorrência para horário cheio por transação SQL, limite antiabuso Redis e RLS para dados privados.
- E-mail de nova solicitação para **SEU-EMAIL@exemplo.com** via Resend, aviso ao cliente ao mudar status (quando forneceu e-mail) e alerta de Pix confirmado.
- Integração Mercado Pago Pix: criação de transação/QR Code pelo servidor, confirmação por **webhook assinado e consulta ao provedor**. Não marca como pago só pelo cliente clicar.
- WhatsApp: encaminha resumo ao número oficial, cliente toca em Enviar. Mensagens automáticas de status pela API oficial Meta **somente se habilitadas**, usando template aprovado (ou use o botão manual do painel).
- Fidelidade: ao marcar como entregue um múltiplo de *N* pedidos daquele cliente, com `LOYALTY_PEPPER` configurado, cria cupom exclusivo, comunicado por e-mail quando houver endereço disponível. Descontos promocionais via cupons também funcionam.
- PWA com manifest, ícones PNG e service worker para leitura do site offline (não recebe pedidos offline). Página informativa de privacidade para adaptar à LGPD.

## Antes de usar de verdade: modo de demonstração x produção

**Sem as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o React entra em DEMONSTRAÇÃO:** catálogo e checkout de teste, cupons, agendamento e painel administrativo bloqueado, com pedidos de teste guardados **somente neste aparelho**. Pode abrir WhatsApp real com mensagem, mas **não processa Pix, não envia e-mail, não compartilha pedidos entre aparelhos e não oferece autenticação real**. Não publique a demonstração como loja comercial sem os ajustes.

**Com Supabase configurado**, a loja passa a usar o catálogo do banco, o painel requer conta autorizada e pedidos são criados no servidor. **Não basta definir apenas duas variáveis frontend**: siga todos os passos abaixo; pedidos ficarão indisponíveis até que a proteção Redis esteja instalada.

Todos os valores, fotos e horários iniciais são **EXEMPLOS**, não são dados fornecidos pela confeitaria. Antes da publicação revise-os no painel. Não existem avaliações de clientes inventadas: o site traz destaques comerciais e espaço para avaliações reais futuras.

## 1 — Rodar localmente

Pré-requisito: Node.js >=20 (recomendado 22).

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173` no computador; para abrir no celular na mesma rede, `http://IP_DO_COMPUTADOR:5173` (Vite configurado com `--host 0.0.0.0`).

```bash
npm run build
npm run preview
npm run check
```

No modo demonstração, clicar em **Acesso restrito** no rodapé apresenta a informação de que o painel está bloqueado sem autenticação real. Não existe senha de teste. Limpar o armazenamento do navegador apaga o histórico local. Na versão de produção, somente administradores autenticados e autorizados visualizam pedidos no Supabase.

## 2 — Criar Supabase

1. Crie um projeto [Supabase](https://supabase.com/), anote a **Project URL** e a chave pública **anon / publishable**, e mantenha a chave **service_role** apenas no servidor.
2. Execute `supabase/migrations/001_drica_doces.sql` no SQL Editor. **Execute apenas uma vez** em um projeto novo.
3. No Supabase Authentication → Users, crie um usuário real para sua esposa com e-mail e senha forte (sem credenciais fixas no projeto).
4. Copie o UUID gerado em Authentication → Users. No SQL Editor, execute:

   ```sql
   insert into public.admin_users(user_id) values ('UUID-DO-USUARIO-AUTORIZADO');
   ```

5. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel ou no `.env.local`. Habilite as variáveis de servidor descritas abaixo.

O banco habilita **RLS**; apenas administradores cadastrados podem gerenciar dados. A criação pública de encomendas ocorre por função serverless com **service_role protegida** e uma rotina SQL transacional. Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, chaves do Mercado Pago, Resend ou Meta no frontend.

## 3 — Criar serviço de envio de e-mail e proteção contra abusos

- Crie conta no [Resend](https://resend.com), valide um **domínio de remetente** e gere `RESEND_API_KEY`. Defina `RESEND_FROM_EMAIL` usando um e-mail do domínio autorizado. **O destinatário já é `SEU-EMAIL@exemplo.com`** e pode ser alterado por `ORDER_NOTIFICATION_EMAIL`.
- Crie banco no [Upstash Redis](https://upstash.com/); configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. **A API de pedidos recusa solicitações em produção sem estes dados**, para evitar disparos abusivos sem proteção. Há limites por IP em pedidos, consultas e geração de Pix. Para reforçar segurança, coloque Cloudflare Turnstile/WAF na borda, proteção de bots e monitoração de logs.
- Para testar funções localmente com variáveis do servidor, use `npx vercel dev` (o `npm run dev` do Vite **não serve** `/api/**`).

Um e-mail de **nova solicitação** é enviado assim que o registro de pedido é criado. O site **não confirma** que o cliente enviou a mensagem no WhatsApp. Falha no e-mail não apaga o pedido gravado. Se o cliente não informar e-mail, status ainda pode ser acompanhado no site, e o painel apresenta um link manual para contato via WhatsApp.

## 4 — Mercado Pago Pix (opcional até habilitar)

1. Crie uma aplicação no [Mercado Pago Developers](https://www.mercadopago.com.br/developers/), obtenha o **access token de produção**, configure `MERCADOPAGO_ACCESS_TOKEN` no Vercel.
2. Configure `PUBLIC_SITE_URL=https://seudominio.com.br` apontando ao domínio real, com HTTPS.
3. Em Webhooks do Mercado Pago, cadastre `https://seudominio.com.br/api/webhooks/mercadopago` para eventos de **payment**, copie a assinatura secreta de webhook para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Gere um pedido de teste via ambiente correto de testes, acompanhe a resposta do provedor e o webhook no servidor. Teste idempotência, estados e reenvios antes de habilitar pagamentos reais.

O servidor cria Pix com `X-Idempotency-Key`, consulta a cobrança real pelo ID no webhook, valida HMAC, valor, moeda e vínculo ao pedido antes de marcar como aprovado. **Pedidos de entrega sem taxa cadastrada não podem ser criados online nem gerar Pix**. O cliente será orientado a cotar pelo WhatsApp ou escolher retirada. CPF vai diretamente para a requisição de pagamento; não é guardado em `orders`.

## 5 — WhatsApp e fidelidade

- Solicitações vão para **5511960829925**, com resumo montado depois de registrar pedido. O cliente deve apertar **Enviar** no WhatsApp; o site não pode verificar o envio.
- Notificações automáticas do **WhatsApp Business Platform/Meta** exigem número comercial habilitado e template aprovado em português do Brasil com **três variáveis** (`nome`, `código`, `status`). Defina `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_TEMPLATE_NAME` no ambiente de servidor. Sem isso, use o link manual do painel. Pode haver custos do serviço.
- Para cupons de fidelidade pessoais, configure uma string longa aleatória em `LOYALTY_PEPPER`, somente no servidor. Ao completar o número de encomendas **entregues** definido em Configurações, um cupom pessoal será gerado com limite de um uso. O cliente recebe por e-mail se tiver informado endereço; senão o cupom estará visível na aba Cupons do painel.

## 6 — Publicar

Envie esta pasta a um repositório privado e importe no [Vercel](https://vercel.com/). Configure:

| Variável | Local |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Frontend público |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Servidor privado |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `ORDER_NOTIFICATION_EMAIL` | Servidor privado |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Servidor privado |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` / `PUBLIC_SITE_URL` | Servidor privado, Pix |
| `LOYALTY_PEPPER` | Servidor privado, fidelidade |
| `META_WHATSAPP_*` | Servidor privado, automações oficiais opcionais |

Faça deploy com comando `npm run build`, diretório `dist`. Verifique que o botão da loja abre o WhatsApp certo. Confirme preços, fotos, horários, endereço de retirada, regiões de entrega, Instagram, políticas da LGPD e autenticação antes de divulgar o link público.

## Estrutura

```text
src/App.jsx            # UI cliente, catálogo, status e administração
src/GuidedCheckout.jsx # Checkout em três etapas, revisão e frete calculado
src/api.js             # Conexão Supabase, modo demo e rotas HTTPS
src/data.js            # Marca, preços de exemplo e formatação em R$
api/orders/create.js  # Registro de encomenda, preço/cupom/entrega/agenda e e-mail
api/orders/track.js   # Consulta privada de andamento
api/payments/pix.js   # Solicitação de Pix ao Mercado Pago
api/webhooks/mercadopago.js  # Confirmação assinada + consulta ao provedor
api/admin/status.js   # Alteração autenticada de status + alertas + fidelidade
api/_shared/utils.js  # Segurança, Resend, rate limit, Meta Cloud API
supabase/migrations/001_drica_doces.sql # Schema, RLS, proteção transacional
public/               # PWA + política de privacidade
```

### Transparência sobre testes

Foi verificada a **sintaxe** dos arquivos JavaScript do servidor e a **análise sintática JSX** via transpiler TypeScript. O `npm install` não concluiu neste ambiente por falha de resolução DNS (`EAI_AGAIN`), portanto **build, testes end-to-end, conexão real ao Supabase, Pix, entrega de e-mail e deploy NÃO foram validados aqui**. Execute e valide todo fluxo numa implantação de teste antes de utilizar comercialmente.

## Prévia independente (sem instalar nada)

Abra `PREVIA-SEM-BACKEND.html` no Chrome do celular ou computador. É uma **demonstração independente** com checkout em três etapas, carrinho, CEP, frete sujeito à configuração, WhatsApp, cupom de teste, presente e **consulta individual de andamento** por código e WhatsApp. **O painel de gestão permanece bloqueado**, pois esta prévia não tem backend de autenticação. Não é o mesmo build React, não envia alertas por e-mail e não processa pagamentos Pix. O projeto React é a implementação principal e contém a interface premium redesenhada.
