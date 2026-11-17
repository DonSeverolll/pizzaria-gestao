// Testes da camada Firestore (so rodam no emulador: npm run test:firestore).
// Cobrem o que antes era garantido por restricoes do banco SQL e agora
// depende de transacoes: logins unicos, IDs numericos, codigo de pedido,
// pagamento confirmado uma vez so e saldos de caixa e estoque.
const test = require('node:test');
const assert = require('node:assert/strict');

const enabled =
  String(process.env.DB_PROVIDER).toLowerCase() === 'firestore' && Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (!enabled) {
  test('camada Firestore', { skip: 'rode com npm run test:firestore' }, () => {});
  return;
}

process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = `demo-pizzaria-db-${process.pid}`;

const db = require('../backend/db');

test.after(async () => {
  await db.closeDb();
});

test('provedor e dados iniciais', async () => {
  assert.equal(db.currentProvider(), 'firestore');
  await db.createDb();
  assert.equal((await db.getUserByUsername('admin')).role, 'admin');
  assert.ok((await db.getMenuItems()).length >= 10);
  assert.equal((await db.getStoreSettings()).company_name, 'PL Pizza');
  assert.equal((await db.getStoreHours()).length, 7);
});

test('IDs numericos sequenciais e login unico', async () => {
  const first = await db.createStaffUser({ username: 'caixa1', password: 'senha-caixa', role: 'caixa' });
  const second = await db.createStaffUser({ username: 'caixa2', password: 'senha-caixa', role: 'caixa' });
  assert.equal(typeof first.id, 'number');
  assert.equal(second.id, first.id + 1);
  assert.equal(first.password_hash, undefined, 'hash nao sai do repositorio');

  await assert.rejects(() => db.createStaffUser({ username: 'CAIXA1', password: 'outra-senha', role: 'caixa' }));
  await assert.rejects(() => db.createCustomer({ name: 'Repetido', login: 'cliente', password: 'senha-forte' }));
});

test('pedido: transacao grava itens, codigo, contador do cliente e CRM', async () => {
  const customer = await db.createCustomer({ name: 'Joana', login: 'joana', password: 'senha-forte' });
  const order = await db.createOrder({
    customerId: customer.id,
    customerName: 'Joana',
    customerLogin: 'joana',
    customerPhone: '(81) 98888-1111',
    items: [{ name: 'Calabresa', quantity: 2, price: 30, itemTotal: 60 }],
    totalValue: 60,
  });

  assert.match(order.order_code, /^PL-[A-Z2-9]{6}$/);
  assert.equal(order.items.length, 1);
  assert.match(order.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal((await db.getOrderByCode(order.order_code.toLowerCase())).id, order.id);
  assert.equal((await db.getCustomerByLogin('joana')).order_count, 1);

  const crm = (await db.getCrmCustomers()).find((entry) => entry.key === 'phone:81988881111');
  assert.equal(crm.orders, 1);
  assert.equal(crm.totalSpent, 60);
  assert.equal(crm.segment, 'novo');
});

test('pagamento confirma uma vez so e nao reabre pedido finalizado', async () => {
  const order = await db.createOrder({
    customerName: 'Pix',
    items: [{ name: 'Margherita', quantity: 1, price: 34 }],
    totalValue: 34,
    status: 'aguardando-pagamento',
  });

  const results = await Promise.all([db.markOrderPaid(order.id), db.markOrderPaid(order.id)]);
  assert.deepEqual(results.sort(), [false, true], 'so uma das confirmacoes simultaneas vale');

  await db.updateOrderStatus(order.id, 'entregue');
  assert.equal(await db.markOrderPaid(order.id), false);
  assert.equal(await db.cancelUnpaidOrder(order.id), false);
  assert.equal((await db.getOrderById(order.id)).status, 'entregue');
});

test('imagem de produto vai para o Cloud Storage', { skip: !process.env.FIREBASE_STORAGE_EMULATOR_HOST && 'sem emulador do Storage' }, async () => {
  process.env.FIREBASE_STORAGE_BUCKET = 'demo-pizzaria.appspot.com';
  const { uploadImage } = require('../backend/storage');
  const { getStorage } = require('firebase-admin/storage');
  const { getApp } = require('../backend/db/firestore/client');

  // Menor PNG valido (1x1).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const url = await uploadImage(png, 'pizza.png', 'image/png');
  assert.match(url, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/demo-pizzaria\.appspot\.com\/o\/produtos%2F.+\?alt=media&token=/);

  const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
  const [exists] = await getStorage(getApp()).bucket('demo-pizzaria.appspot.com').file(path).exists();
  assert.equal(exists, true);
});

test('caixa e estoque: movimento e saldo juntos', async () => {
  const register = await db.openCashRegister({ initialBalance: 50 });
  await Promise.all([
    db.addCashMovement({ registerId: register.id, type: 'entrada', amount: 10 }),
    db.addCashMovement({ registerId: register.id, type: 'entrada', amount: 15 }),
    db.addCashMovement({ registerId: register.id, type: 'saida', amount: 5 }),
  ]);
  const current = await db.getCashRegister();
  assert.equal(current.cash_total, 25, 'entradas simultaneas nao se perdem');
  assert.equal(current.withdrawals, 5);
  assert.equal(current.movements.length, 3);

  const item = await db.createInventoryItem({ ingredientName: 'Manjericão', unit: 'maço', quantity: 10 });
  await assert.rejects(() => db.createInventoryItem({ ingredientName: 'manjericão', unit: 'maço' }));
  await db.addInventoryMovement({ id: item.id, movementType: 'saida', quantity: 3 });
  assert.equal((await db.getInventoryItem(item.id)).quantity, 7);
  assert.equal((await db.getInventoryMovements('Manjericão')).length, 1);

  await db.deleteInventoryItem(item.id);
  assert.equal(await db.getInventoryItem(item.id), undefined);
  assert.deepEqual(await db.getInventoryMovements('Manjericão'), []);
});
