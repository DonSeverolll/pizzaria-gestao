// Testes da camada de dados: migracoes versionadas, dados iniciais e
// repositorios, num SQLite em memoria.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
delete process.env.SQLITE_PATH;

const db = require('../backend/db');
const { loadMigrations } = require('../backend/db/migrate');

test.after(async () => {
  await db.closeDb();
});

test('migracoes tem versoes unicas e em ordem', () => {
  const migrations = loadMigrations();
  assert.ok(migrations.length >= 3);
  const versions = migrations.map((migration) => migration.version);
  assert.deepEqual(versions, [...versions].sort());
  assert.equal(new Set(versions).size, versions.length);
});

test('createDb aplica todas as migracoes e registra em schema_migrations', async () => {
  const { provider } = await db.createDb();
  assert.equal(provider, 'sqlite');

  const applied = await db.all('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(
    applied.map((row) => row.version),
    loadMigrations().map((migration) => migration.version)
  );

  // Rodar de novo nao reaplica nada.
  assert.deepEqual(await db.migrate(), []);
});

test('esquema tem as tabelas e colunas usadas pelo app', async () => {
  await db.createDb();
  const tables = (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((row) => row.name);
  for (const table of ['users', 'customers', 'menu_items', 'orders', 'order_items', 'store_settings', 'cash_register', 'inventory', 'product_extras']) {
    assert.ok(tables.includes(table), `tabela ${table} deveria existir`);
  }

  const orderColumns = (await db.all("PRAGMA table_info('orders')")).map((row) => row.name);
  for (const column of ['order_code', 'payment_provider', 'customer_phone', 'origin']) {
    assert.ok(orderColumns.includes(column), `orders.${column} deveria existir`);
  }

  const indexes = (await db.all("SELECT name FROM sqlite_master WHERE type = 'index'")).map((row) => row.name);
  assert.ok(indexes.includes('idx_orders_order_code'));
});

test('dados iniciais: dono, cardapio, mesas e configuracoes', async () => {
  await db.createDb();
  const admin = await db.getUserByUsername('admin');
  assert.equal(admin.role, 'admin');

  assert.ok((await db.getMenuItems()).length >= 10);
  assert.ok((await db.getTables()).length >= 1);
  assert.equal((await db.getStoreSettings()).company_name, 'PL Pizza');
});

test('repositorios nao expoem hash de senha', async () => {
  await db.createDb();
  const created = await db.createCustomer({ name: 'Teste', login: 'repo-teste', password: 'senha-forte' });
  assert.equal(created.password_hash, undefined);
  assert.ok((await db.getCustomers()).every((customer) => customer.password_hash === undefined));
  assert.ok((await db.listUsers()).every((user) => user.password_hash === undefined));
});

test('pagamento so confirma pedido que aguarda pagamento', async () => {
  await db.createDb();
  const order = await db.createOrder({
    customerName: 'Teste',
    items: [{ name: 'X', quantity: 1, price: 10 }],
    totalValue: 10,
    status: 'aguardando-pagamento',
  });
  assert.match(order.order_code, /^PL-[A-Z2-9]{6}$/);

  assert.equal(await db.markOrderPaid(order.id), true);
  assert.equal((await db.getOrderById(order.id)).status, 'em-preparo');

  await db.updateOrderStatus(order.id, 'entregue');
  assert.equal(await db.markOrderPaid(order.id), false, 'reenvio do aviso nao reabre pedido entregue');
  assert.equal((await db.getOrderById(order.id)).status, 'entregue');
});
