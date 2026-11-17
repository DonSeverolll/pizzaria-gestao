// Relatorio de vendas e carteira do CRM no Firestore.
//
// O CRM nao varre mais todos os pedidos: cada pedido atualiza
// crmCustomers/{chave} na hora (ver orders.js). Aqui so le essa colecao, uma
// leitura por cliente, que e o que pesa no custo do Firestore.
const { getDb, Timestamp, rowsOf } = require('../client');
const { createDb } = require('../lifecycle');

const db = () => getDb();

function resolvePeriodRange(period, from, to) {
  const current = new Date();
  const endOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59, 999);

  if (period === 'custom' && from && to) {
    return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) };
  }
  if (period === '7d') {
    return { start: new Date(current.getFullYear(), current.getMonth(), current.getDate() - 6), end: endOfToday };
  }
  if (period === 'month') {
    return { start: new Date(current.getFullYear(), current.getMonth(), 1), end: endOfToday };
  }
  return { start: new Date(current.getFullYear(), current.getMonth(), current.getDate()), end: endOfToday };
}

async function getSalesReport({ period = 'today', from, to }) {
  await createDb();
  const { start, end } = resolvePeriodRange(period, from, to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('Período inválido.');
    error.statusCode = 400;
    throw error;
  }

  const orders = rowsOf(
    await db()
      .collection('orders')
      .where('created_at', '>=', Timestamp.fromDate(start))
      .where('created_at', '<=', Timestamp.fromDate(end))
      .orderBy('created_at', 'desc')
      .get()
  );

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_value || 0), 0);
  const totalOrders = orders.length;

  const productTotals = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const entry = productTotals.get(item.product_name) || { name: item.product_name, quantity: 0, revenue: 0 };
      entry.quantity += Number(item.quantity || 0);
      entry.revenue += Number(item.item_total || 0);
      productTotals.set(item.product_name, entry);
    }
  }

  const products = Array.from(productTotals.values()).sort((a, b) => b.revenue - a.revenue);
  let cumulative = 0;
  for (const product of products) {
    product.share = totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0;
    cumulative += product.share;
    product.class = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
  }

  return {
    period,
    from: start.toISOString(),
    to: end.toISOString(),
    totalRevenue,
    totalOrders,
    avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    products,
  };
}

async function getCrmCustomers() {
  await createDb();
  const DAY = 24 * 60 * 60 * 1000;
  const current = Date.now();

  return rowsOf(await db().collection('crmCustomers').get())
    .map((entry) => {
      const lastMs = entry.lastOrderAt ? new Date(`${String(entry.lastOrderAt).replace(' ', 'T')}Z`).getTime() : null;
      const daysSince = lastMs ? Math.max(0, Math.floor((current - lastMs) / DAY)) : null;
      const orders = Number(entry.orders || 0);
      const totalSpent = Number(entry.totalSpent || 0);

      let segment = 'sem-pedido';
      if (orders > 0) {
        if (daysSince !== null && daysSince > 60) segment = 'inativo';
        else if (orders >= 3) segment = 'recorrente';
        else segment = 'novo';
      }

      return {
        key: entry.key,
        name: entry.name,
        phone: entry.phone ?? null,
        login: entry.login ?? null,
        registered: Boolean(entry.registered),
        orders,
        totalSpent,
        lastOrderAt: entry.lastOrderAt ?? null,
        lastAddress: entry.lastAddress ?? null,
        ticket: orders ? totalSpent / orders : 0,
        daysSinceLastOrder: daysSince,
        segment,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

module.exports = { getSalesReport, getCrmCustomers };
