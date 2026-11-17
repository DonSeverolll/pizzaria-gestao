// Relatorio de vendas (curva ABC) e carteira de clientes do CRM.
const { all } = require('../connection');
const { createDb } = require('../lifecycle');
const { attachItems } = require('./orders');

function resolvePeriodRange(period, from, to) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'custom' && from && to) {
    return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) };
  }

  if (period === '7d') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0), end: endOfToday };
  }

  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end: endOfToday };
  }

  return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0), end: endOfToday };
}

// CURRENT_TIMESTAMP grava em UTC ("2026-11-17 14:05:00" no SQLite,
// "...+00" no Postgres). Sem fuso explicito, o texto e lido como UTC: lido
// como hora local, um pedido recem-feito aparecia "ha -1 dia" no CRM.
function parseDbTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  const text = String(value)
    .trim()
    .replace(' ', 'T')
    // Postgres escreve o fuso como "+00" ou "-0300"; o Date do JS quer "+00:00".
    .replace(/([+-]\d{2})$/, '$1:00')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/i.test(text);
  const ms = new Date(hasZone ? text : `${text}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function toSqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function getSalesReport({ period = 'today', from, to }) {
  await createDb();
  const { start, end } = resolvePeriodRange(period, from, to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('Período inválido.');
    error.statusCode = 400;
    throw error;
  }

  const orders = await attachItems(
    await all('SELECT * FROM orders WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC', [
      toSqlTimestamp(start),
      toSqlTimestamp(end),
    ])
  );

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_value || 0), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const productTotals = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product_name;
      const entry = productTotals.get(key) || { name: key, quantity: 0, revenue: 0 };
      entry.quantity += Number(item.quantity || 0);
      entry.revenue += Number(item.item_total || 0);
      productTotals.set(key, entry);
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
    avgTicket,
    products,
  };
}

// CRM: monta a carteira de clientes a partir dos pedidos reais, porque a maior
// parte das vendas e de visitante sem cadastro (so nome e telefone no checkout).
async function getCrmCustomers() {
  await createDb();
  const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
  const registered = await all('SELECT id, name, login FROM customers');

  const byKey = new Map();

  for (const customer of registered) {
    byKey.set(`login:${customer.login}`, {
      key: `login:${customer.login}`,
      name: customer.name,
      phone: null,
      login: customer.login,
      registered: true,
      orders: 0,
      totalSpent: 0,
      lastOrderAt: null,
      lastAddress: null,
    });
  }

  for (const order of orders) {
    // Telefone e a identidade mais confiavel; cai para login e depois nome.
    const key = order.customer_phone
      ? `phone:${String(order.customer_phone).replace(/\D/g, '')}`
      : order.customer_login
        ? `login:${order.customer_login}`
        : `name:${String(order.customer_name || 'Cliente').toLowerCase().trim()}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: order.customer_name || 'Cliente',
        phone: order.customer_phone || null,
        login: order.customer_login || null,
        registered: false,
        orders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        lastAddress: null,
      });
    }

    const entry = byKey.get(key);
    entry.orders += 1;
    entry.totalSpent += Number(order.total_value || 0);
    entry.phone = entry.phone || order.customer_phone || null;
    entry.name = entry.name || order.customer_name;
    if (!entry.lastOrderAt || order.created_at > entry.lastOrderAt) {
      entry.lastOrderAt = order.created_at;
      entry.lastAddress = order.delivery_location || entry.lastAddress;
    }
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  return Array.from(byKey.values())
    .map((entry) => {
      const lastMs = entry.lastOrderAt ? parseDbTimestamp(entry.lastOrderAt) : null;
      const daysSince = lastMs ? Math.max(0, Math.floor((now - lastMs) / DAY)) : null;

      let segment = 'sem-pedido';
      if (entry.orders > 0) {
        if (daysSince !== null && daysSince > 60) segment = 'inativo';
        else if (entry.orders >= 3) segment = 'recorrente';
        else segment = 'novo';
      }

      return {
        ...entry,
        ticket: entry.orders ? entry.totalSpent / entry.orders : 0,
        daysSinceLastOrder: daysSince,
        segment,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

module.exports = {
  getSalesReport,
  getCrmCustomers,
};
