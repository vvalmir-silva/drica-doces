/**
 * Carregamento independente das seções do painel.
 * Cada consulta é feita com a sessão Supabase do administrador e fica sujeita a RLS.
 * Falha em um recurso opcional não pode esconder encomendas existentes.
 */
export async function fetchAdminData(db) {
  const orderResponse = await db.from('orders').select('*').order('created_at', {ascending: false}).limit(100);
  if (orderResponse.error) {
    throw new Error(`Falha ao consultar encomendas: ${orderResponse.error.message}`);
  }
  const orders = orderResponse.data || [];
  const warnings = [];
  let orderItems = [];
  if (orders.length) {
    try {
      const ids = orders.map(order => order.id);
      const result = await db.from('order_items').select('*').in('order_id', ids);
      if (result.error) warnings.push(`Itens das encomendas: ${result.error.message}`);
      else orderItems = result.data || [];
    } catch (err) {
      warnings.push(`Itens das encomendas: ${err.message || 'não disponíveis'}`);
    }
  }
  const itemsByOrder = new Map();
  for (const item of orderItems) {
    const arr = itemsByOrder.get(item.order_id) || [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  }
  const completeOrders = orders.map(order => ({...order, order_items: itemsByOrder.get(order.id) || []}));

  const optionalQueries = [
    ['products', 'Produtos', () => db.from('products').select('*').order('created_at')],
    ['coupons', 'Cupons', () => db.from('coupons').select('*')],
    ['zones', 'Regiões de entrega', () => db.from('delivery_zones').select('*')],
    ['blocked', 'Datas bloqueadas', () => db.from('blocked_dates').select('*')],
    ['settings', 'Configurações', () => db.from('shop_settings').select('*').eq('id',1).single()],
    ['inventory', 'Estoque', () => db.from('inventory_items').select('*').order('name')],
    ['productionChecks', 'Produção', () => db.from('production_checks').select('*')],
    ['payments', 'Pagamentos', () => db.from('payments').select('order_id,status,amount_cents')],
    ['notifications', 'Notificações', () => db.from('notification_events').select('*').order('created_at',{ascending:false}).limit(100)],
    ['testimonials', 'Depoimentos', () => db.from('testimonials').select('*').order('created_at',{ascending:false}).limit(100)]
  ];
  const settled = await Promise.allSettled(optionalQueries.map(([, ,query]) => query()));
  const output = {orders:completeOrders,warnings};
  settled.forEach((entry, index) => {
    const [key,label] = optionalQueries[index];
    const fallback = key === 'settings' ? null : [];
    if (entry.status === 'rejected') {
      warnings.push(`${label}: ${entry.reason?.message || 'consulta indisponível'}`);
      output[key] = fallback;
      return;
    }
    if (entry.value.error) {
      warnings.push(`${label}: ${entry.value.error.message}`);
      output[key] = fallback;
      return;
    }
    output[key] = entry.value.data ?? fallback;
  });
  return output;
}
