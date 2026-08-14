const test = require('node:test');
const assert = require('node:assert/strict');

const { createDb, closeDb } = require('../backend/db');

test('database initializes tables and seed data', async () => {
  const db = await createDb();
  const menuCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM menu_items', (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });
  const tablesCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM tables', (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });
  const ordersCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM orders', (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });

  assert.ok(menuCount >= 1, 'Should seed menu items');
  assert.ok(tablesCount >= 1, 'Should seed tables');
  assert.ok(ordersCount >= 0, 'Orders table should exist');

  await closeDb();
});

test('seedData populates admin user and client profile metadata', async () => {
  const db = await createDb();
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT username, role FROM users WHERE username = ?', ['admin'], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

  const customerColumns = await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info('customers')", (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((row) => row.name));
    });
  });

  assert.ok(user, 'Admin user should exist');
  assert.ok(customerColumns.includes('name') && customerColumns.includes('login'), 'Customer metadata should exist');
  await closeDb();
});

test('erp tables and store settings exist for admin operations', async () => {
  const db = await createDb();

  const settingsTable = await new Promise((resolve, reject) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'", (err, row) => {
      if (err) return reject(err);
      resolve(row?.name || null);
    });
  });

  const cashTable = await new Promise((resolve, reject) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cash_register'", (err, row) => {
      if (err) return reject(err);
      resolve(row?.name || null);
    });
  });

  assert.equal(settingsTable, 'store_settings', 'Store settings table should exist');
  assert.equal(cashTable, 'cash_register', 'Cash register table should exist');

  await closeDb();
});
