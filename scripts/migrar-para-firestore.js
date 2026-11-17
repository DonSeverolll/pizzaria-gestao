// Copia os dados do banco SQL atual (Postgres/Supabase ou SQLite) para o
// Cloud Firestore, mantendo os IDs.
//
// Uso:
//   node scripts/migrar-para-firestore.js --simular     (so le e confere)
//   node scripts/migrar-para-firestore.js               (grava no Firestore)
//
// Origem: SUPABASE_DB_URL/DATABASE_URL (Postgres) ou, sem eles, o SQLite
// local (SQLITE_PATH ou data/pizzaria.db). Destino: FIREBASE_PROJECT_ID +
// credenciais (ou o emulador, com FIRESTORE_EMULATOR_HOST).
//
// Seguranca: recusa gravar num Firestore que ja tenha pedidos ou usuarios,
// a menos que receba --substituir. O banco de origem so e lido.
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--simular');
const REPLACE = args.has('--substituir');

// A camada SQL decide o provedor pelo DB_PROVIDER no carregamento.
const hasPostgres = Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL);
process.env.DB_PROVIDER = hasPostgres ? 'postgres' : 'sqlite';
process.env.DB_SESSION_MODE = '1';

const sql = require('../backend/db/connection');
const { getDb, closeFirestore, Timestamp, keyOf, projectId } = require('../backend/db/firestore/client');
const { crmKeyFor } = require('../backend/db/firestore/repositories/orders');

const BATCH_LIMIT = 450;

// "AAAA-MM-DD HH:MM:SS" (SQLite, UTC), texto do Postgres com fuso ou Date.
function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Timestamp.fromDate(value);
  const text = String(value)
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/i.test(text);
  const date = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

const num = (value) => (value === null || value === undefined ? null : Number(value));

async function readSource() {
  const provider = await sql.prepareProvider();
  const table = async (name, order = 'id') => sql.all(`SELECT * FROM ${name} ORDER BY ${order}`);
  return {
    provider,
    users: await table('users'),
    customers: await table('customers'),
    menuItems: await table('menu_items'),
    extras: await table('product_extras'),
    tables: await table('tables'),
    orders: await table('orders'),
    orderItems: await table('order_items'),
    settings: (await sql.all('SELECT * FROM store_settings ORDER BY id DESC'))[0] || null,
    hours: await table('store_hours', 'day_of_week'),
    registers: await table('cash_register'),
    movements: await table('cash_movements'),
    inventory: await table('inventory'),
    inventoryMovements: await table('inventory_movements'),
  };
}

// Monta a lista de gravacoes: [{ path, data }].
function buildWrites(source) {
  const writes = [];
  const put = (path, data) => writes.push({ path, data });
  const counters = {};
  const track = (name, id) => {
    counters[name] = Math.max(counters[name] || 0, Number(id) || 0);
  };

  for (const user of source.users) {
    put(`users/${user.id}`, { ...user, id: num(user.id), created_at: toTimestamp(user.created_at) });
    put(`usernames/${keyOf(user.username)}`, { userId: num(user.id) });
    track('users', user.id);
  }

  for (const customer of source.customers) {
    put(`customers/${customer.id}`, {
      ...customer,
      id: num(customer.id),
      order_count: num(customer.order_count) || 0,
      created_at: toTimestamp(customer.created_at),
      updated_at: toTimestamp(customer.updated_at),
    });
    put(`customerLogins/${keyOf(customer.login)}`, { customerId: num(customer.id) });
    track('customers', customer.id);
  }

  for (const item of source.menuItems) {
    put(`menuItems/${item.id}`, { ...item, id: num(item.id), price: num(item.price), active: num(item.active ?? 1) });
    track('menuItems', item.id);
  }

  for (const extra of source.extras) {
    put(`extras/${extra.id}`, {
      ...extra,
      id: num(extra.id),
      price: num(extra.price),
      active: num(extra.active ?? 1),
      created_at: toTimestamp(extra.created_at),
    });
    track('extras', extra.id);
  }

  for (const table of source.tables) {
    put(`tables/${table.id}`, { ...table, id: num(table.id), capacity: num(table.capacity), updated_at: toTimestamp(table.updated_at) });
    track('tables', table.id);
  }

  // Pedidos com os itens embutidos e a carteira do CRM recalculada.
  const itemsByOrder = new Map();
  for (const item of source.orderItems) {
    const list = itemsByOrder.get(Number(item.order_id)) || [];
    list.push(item);
    itemsByOrder.set(Number(item.order_id), list);
  }

  const crm = new Map();
  for (const customer of source.customers) {
    crm.set(`login:${customer.login}`, {
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

  for (const order of source.orders) {
    const items = (itemsByOrder.get(Number(order.id)) || []).map((item, index) => ({
      id: index + 1,
      order_id: num(order.id),
      product_name: item.product_name,
      product_description: item.product_description || '',
      quantity: num(item.quantity) || 1,
      unit_price: num(item.unit_price) || 0,
      item_total: num(item.item_total) || 0,
      notes: item.notes || '',
    }));
    const createdAt = toTimestamp(order.created_at);
    put(`orders/${order.id}`, {
      ...order,
      id: num(order.id),
      customer_id: num(order.customer_id),
      total_value: num(order.total_value) || 0,
      created_at: createdAt,
      updated_at: toTimestamp(order.updated_at),
      items,
    });
    if (order.order_code) put(`orderCodes/${String(order.order_code).toUpperCase()}`, { orderId: num(order.id) });
    track('orders', order.id);

    const key = crmKeyFor(order);
    const entry =
      crm.get(key) ||
      { key, name: order.customer_name || 'Cliente', phone: order.customer_phone || null, login: order.customer_login || null, registered: false, orders: 0, totalSpent: 0, lastOrderAt: null, lastAddress: null };
    entry.orders += 1;
    entry.totalSpent += num(order.total_value) || 0;
    entry.phone = entry.phone || order.customer_phone || null;
    if (!entry.lastOrderAt || (createdAt && createdAt.toMillis() > entry.lastOrderAt.toMillis())) {
      entry.lastOrderAt = createdAt;
      entry.lastAddress = order.delivery_location || entry.lastAddress;
    }
    crm.set(key, entry);
  }
  for (const entry of crm.values()) put(`crmCustomers/${keyOf(entry.key)}`, entry);

  if (source.settings) {
    put('settings/store', { ...source.settings, id: 1, updated_at: toTimestamp(source.settings.updated_at) });
  }
  put('settings/hours', {
    hours: source.hours.map((hour) => ({ ...hour, id: num(hour.id), day_of_week: num(hour.day_of_week), enabled: num(hour.enabled), created_at: toTimestamp(hour.created_at) })),
  });

  for (const register of source.registers) {
    put(`cashRegisters/${register.id}`, {
      ...register,
      id: num(register.id),
      initial_balance: num(register.initial_balance) || 0,
      cash_total: num(register.cash_total) || 0,
      pix_total: num(register.pix_total) || 0,
      card_total: num(register.card_total) || 0,
      withdrawals: num(register.withdrawals) || 0,
      created_at: toTimestamp(register.created_at),
    });
    track('cashRegisters', register.id);
  }
  for (const movement of source.movements) {
    if (!movement.register_id) continue;
    put(`cashRegisters/${movement.register_id}/movements/${movement.id}`, {
      ...movement,
      id: num(movement.id),
      register_id: num(movement.register_id),
      amount: num(movement.amount) || 0,
      created_at: toTimestamp(movement.created_at),
    });
    track('cashMovements', movement.id);
  }

  const inventoryIdByName = new Map();
  for (const item of source.inventory) {
    put(`inventory/${item.id}`, {
      ...item,
      id: num(item.id),
      quantity: num(item.quantity) || 0,
      minimum_quantity: num(item.minimum_quantity) || 0,
      updated_at: toTimestamp(item.updated_at),
    });
    put(`inventoryNames/${keyOf(item.ingredient_name)}`, { itemId: num(item.id) });
    inventoryIdByName.set(item.ingredient_name, item.id);
    track('inventory', item.id);
  }
  let orphanMovements = 0;
  for (const movement of source.inventoryMovements) {
    const itemId = inventoryIdByName.get(movement.ingredient_name);
    if (!itemId) {
      orphanMovements += 1; // ingrediente ja excluido: historico sem dono
      continue;
    }
    put(`inventory/${itemId}/movements/${movement.id}`, {
      ...movement,
      id: num(movement.id),
      quantity: num(movement.quantity) || 0,
      created_at: toTimestamp(movement.created_at),
    });
    track('inventoryMovements', movement.id);
  }

  for (const [name, value] of Object.entries(counters)) put(`counters/${name}`, { value });

  return { writes, orphanMovements };
}

async function firestoreHasData() {
  const db = getDb();
  const [orders, users] = await Promise.all([db.collection('orders').limit(1).get(), db.collection('users').limit(1).get()]);
  return !orders.empty || !users.empty;
}

async function commitWrites(writes) {
  const db = getDb();
  for (let start = 0; start < writes.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const { path, data } of writes.slice(start, start + BATCH_LIMIT)) {
      batch.set(db.doc(path), data);
    }
    await batch.commit();
    process.stdout.write(`  ${Math.min(start + BATCH_LIMIT, writes.length)}/${writes.length} documentos\r`);
  }
  process.stdout.write('\n');
}

async function verify(source) {
  const db = getDb();
  const count = async (name) => (await db.collection(name).count().get()).data().count;
  const orders = await db.collection('orders').get();
  const revenue = orders.docs.reduce((sum, doc) => sum + Number(doc.data().total_value || 0), 0);
  const sourceRevenue = source.orders.reduce((sum, order) => sum + Number(order.total_value || 0), 0);

  const checks = [
    ['pedidos', source.orders.length, orders.size],
    ['clientes', source.customers.length, await count('customers')],
    ['funcionarios', source.users.length, await count('users')],
    ['produtos', source.menuItems.length, await count('menuItems')],
    ['faturamento total', sourceRevenue.toFixed(2), revenue.toFixed(2)],
  ];
  let ok = true;
  for (const [label, expected, actual] of checks) {
    const same = String(expected) === String(actual);
    ok = ok && same;
    console.log(`  ${same ? 'ok   ' : 'DIFERE'} ${label}: origem ${expected} | Firestore ${actual}`);
  }
  return ok;
}

(async () => {
  console.log(`Lendo a origem...`);
  const source = await readSource();
  console.log(
    `Origem ${source.provider}: ${source.orders.length} pedidos, ${source.orderItems.length} itens, ` +
      `${source.customers.length} clientes, ${source.users.length} funcionarios, ${source.menuItems.length} produtos.`
  );

  const { writes, orphanMovements } = buildWrites(source);
  console.log(`Destino Firestore (projeto ${projectId()}): ${writes.length} documentos a gravar.`);
  if (orphanMovements) {
    console.log(`  ${orphanMovements} movimento(s) de estoque de ingredientes ja excluidos ficam de fora.`);
  }

  if (DRY_RUN) {
    console.log('Modo --simular: nada foi gravado.');
  } else {
    if ((await firestoreHasData()) && !REPLACE) {
      throw new Error('O Firestore de destino ja tem dados. Use --substituir para sobrescrever os documentos com os mesmos IDs.');
    }
    await commitWrites(writes);
    console.log('Conferencia:');
    if (!(await verify(source))) {
      process.exitCode = 1;
      console.error('Ha diferencas entre origem e destino: revise antes de trocar o banco em producao.');
    } else {
      console.log('Migracao concluida e conferida.');
    }
  }

  await sql.closeConnections();
  await closeFirestore();
})().catch(async (error) => {
  console.error(`Falha: ${error.message}`);
  await sql.closeConnections().catch(() => {});
  await closeFirestore().catch(() => {});
  process.exit(1);
});
