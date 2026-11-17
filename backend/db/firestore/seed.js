// Dados iniciais no Firestore (mesmo conteudo do seed SQL). So preenche
// colecoes vazias, entao pode rodar a cada inicializacao.
const bcrypt = require('bcryptjs');

const config = require('../../config');
const { BCRYPT_COST, initialAdminPassword, MENU_ITEMS, TABLES, STORE_HOURS, INVENTORY, EXTRAS } = require('../seed');
const { getDb, now, keyOf } = require('./client');

async function isEmpty(collection) {
  const snapshot = await getDb().collection(collection).limit(1).get();
  return snapshot.empty;
}

// Grava uma lista com IDs 1..n e ajusta o contador da colecao.
async function seedCollection(collection, counterName, rows, extraWrites = () => {}) {
  const db = getDb();
  const batch = db.batch();
  rows.forEach((row, index) => {
    const id = index + 1;
    batch.set(db.collection(collection).doc(String(id)), { id, ...row });
    extraWrites(batch, id, row);
  });
  batch.set(db.collection('counters').doc(counterName), { value: rows.length });
  await batch.commit();
}

async function seedData() {
  const db = getDb();
  const createdAt = now();

  if (await isEmpty('users')) {
    const passwordHash = await bcrypt.hash(initialAdminPassword(), BCRYPT_COST);
    await seedCollection(
      'users',
      'users',
      [{ username: 'admin', password_hash: passwordHash, role: 'admin', name: null, created_at: createdAt }],
      (batch, id, row) => batch.set(db.collection('usernames').doc(keyOf(row.username)), { userId: id })
    );
  }

  // Cliente de demonstracao: so fora de producao.
  if (!config.isProduction && (await isEmpty('customers'))) {
    const passwordHash = await bcrypt.hash('cliente123', BCRYPT_COST);
    await seedCollection(
      'customers',
      'customers',
      [
        {
          name: 'Cliente Demo',
          login: 'cliente',
          password_hash: passwordHash,
          payment_key: 'PAY-1001',
          order_count: 1,
          created_at: createdAt,
          updated_at: createdAt,
        },
      ],
      (batch, id, row) => {
        batch.set(db.collection('customerLogins').doc(keyOf(row.login)), { customerId: id });
        batch.set(db.collection('crmCustomers').doc(keyOf(`login:${row.login}`)), {
          key: `login:${row.login}`,
          name: row.name,
          phone: null,
          login: row.login,
          registered: true,
          orders: 0,
          totalSpent: 0,
          lastOrderAt: null,
          lastAddress: null,
        });
      }
    );
  }

  if (await isEmpty('menuItems')) {
    await seedCollection(
      'menuItems',
      'menuItems',
      MENU_ITEMS.map((item) => ({
        ...item,
        flavors: null,
        sizes: null,
        dough_type: null,
        measure: null,
        size_prices: null,
        active: 1,
      }))
    );
  }

  if (await isEmpty('tables')) {
    await seedCollection('tables', 'tables', TABLES.map((table) => ({ ...table, updated_at: createdAt })));
  }

  const settingsRef = db.collection('settings').doc('store');
  if (!(await settingsRef.get()).exists) {
    await settingsRef.set({
      id: 1,
      company_name: 'PL Pizza',
      logo_url: '/logo-pl-real.png',
      phone: '(99) 99999-9999',
      address: 'Rua das Pizzas, 123',
      pix_key: 'plpizza@pix',
      pix_owner_name: null,
      pix_city: null,
      is_open: 1,
      delivery_fee: 9.9,
      delivery_rule: 'fixed',
      free_delivery_min: null,
      updated_at: createdAt,
    });
  }

  const hoursRef = db.collection('settings').doc('hours');
  if (!(await hoursRef.get()).exists) {
    await hoursRef.set({
      hours: STORE_HOURS.map((day, index) => ({ id: index + 1, ...day, enabled: 1, created_at: createdAt })),
    });
  }

  if (await isEmpty('inventory')) {
    await seedCollection(
      'inventory',
      'inventory',
      INVENTORY.map((item) => ({
        ingredient_name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        minimum_quantity: item.minimum,
        updated_at: createdAt,
      })),
      (batch, id, row) => batch.set(db.collection('inventoryNames').doc(keyOf(row.ingredient_name)), { itemId: id })
    );
  }

  if (await isEmpty('extras')) {
    await seedCollection('extras', 'extras', EXTRAS.map((extra) => ({ ...extra, active: 1, created_at: createdAt })));
  }
}

module.exports = { seedData };
