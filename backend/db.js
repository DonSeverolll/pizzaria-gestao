const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'pizzaria.db');

fs.mkdirSync(dataDir, { recursive: true });

let dbInstance = null;
let db = null;

function ensureDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath);
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureDb().run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function createDb() {
  if (dbInstance) {
    return dbInstance;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      payment_key TEXT,
      order_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      ingredients TEXT,
      image TEXT,
      flavors TEXT,
      sizes TEXT,
      dough_type TEXT,
      measure TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_login TEXT,
      status TEXT NOT NULL DEFAULT 'em-preparo',
      delivery_location TEXT,
      payment_method TEXT,
      total_value REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      item_total REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  await seedData();
  dbInstance = db;
  return db;
}

async function seedData() {
  const adminPassword = await bcrypt.hash('admin123', 10);

  await run(
    `INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
    ['admin', adminPassword]
  );

  const sampleCustomerPassword = await bcrypt.hash('cliente123', 10);
  await run(
    `INSERT OR IGNORE INTO customers (name, login, password_hash, payment_key, order_count) VALUES (?, ?, ?, ?, 1)`,
    ['Cliente Demo', 'cliente', sampleCustomerPassword, 'PAY-1001']
  );

  const existingMenu = await all('SELECT COUNT(*) as total FROM menu_items');
  if (existingMenu[0].total === 0) {
    const menuItems = [
      {
        name: 'Calabresa',
        category: 'Pizzas Salgadas e Doces',
        description: 'Pizza grande de massa artesanal com calabresa, cebola e muçarela.',
        price: 30,
        ingredients: 'Calabresa, cebola, muçarela, molho de tomate',
        image: '🍕',
      },
      {
        name: 'Frango com Catupiry',
        category: 'Pizzas Salgadas e Doces',
        description: 'Frango desfiado, catupiry e sabor irresistível em cada pedaço.',
        price: 38,
        ingredients: 'Frango, catupiry, muçarela, cebola',
        image: '🍗',
      },
      {
        name: 'Portuguesa',
        category: 'Pizzas Salgadas e Doces',
        description: 'Presunto, ovos, cebola, azeitona e queijo derretido.',
        price: 36,
        ingredients: 'Presunto, ovos, cebola, azeitona, muçarela',
        image: '🍕',
      },
      {
        name: 'Margherita',
        category: 'Pizzas Salgadas e Doces',
        description: 'Molho de tomate, muçarela, manjericão e azeite.',
        price: 34,
        ingredients: 'Molho, muçarela, manjericão, azeite',
        image: '🌿',
      },
      {
        name: 'Pepperoni',
        category: 'Pizzas Salgadas e Doces',
        description: 'Pepperoni com muçarela e toque de pimenta calabresa.',
        price: 39,
        ingredients: 'Pepperoni, muçarela, pimenta',
        image: '🌶️',
      },
      {
        name: 'Chocolate com Morango',
        category: 'Pizzas Salgadas e Doces',
        description: 'Pizza doce com chocolate, morango e cobertura cremosa.',
        price: 35,
        ingredients: 'Chocolate, morango, leite condensado',
        image: '🍫',
      },
      {
        name: 'Banana com Canela',
        category: 'Pizzas Salgadas e Doces',
        description: 'Doçura equilibrada com banana, canela e cobertura.',
        price: 32,
        ingredients: 'Banana, canela, açúcar, leite condensado',
        image: '🍌',
      },
      {
        name: 'Guaraná de 1L',
        category: 'Bebidas',
        description: 'Super gelada para acompanhar sua pizza favorita.',
        price: 10,
        ingredients: 'Guaraná, gelo',
        image: '🥤',
      },
      {
        name: 'Água Mineral',
        category: 'Bebidas',
        description: 'Água super gelada, ideal para qualquer momento.',
        price: 2,
        ingredients: 'Água mineral',
        image: '💧',
      },
      {
        name: 'Pepsi 1L',
        category: 'Bebidas',
        description: 'Pepsi geladinha para acompanhar o sabor da pizza.',
        price: 10,
        ingredients: 'Pepsi, gelo',
        image: '🥤',
      },
      {
        name: 'H2OH Limoneto 500ml',
        category: 'Bebidas',
        description: 'Refrescante e cítrico, servido bem gelado.',
        price: 6,
        ingredients: 'Limoneto, água, gás',
        image: '🍋',
      },
      {
        name: 'Coca Cola de 1.5L',
        category: 'Bebidas',
        description: 'Garrafa de 1.5L, muito gelada e perfeita para dividir.',
        price: 13,
        ingredients: 'Coca-Cola, gás',
        image: '🥤',
      },
      {
        name: 'Coca Cola zero 1,5L',
        category: 'Bebidas',
        description: 'Versão zero açúcar, gelada e saborosa.',
        price: 13,
        ingredients: 'Coca-Cola Zero, gás',
        image: '🥤',
      },
    ];

    for (const item of menuItems) {
      await run(
        `INSERT INTO menu_items (name, category, description, price, ingredients, image) VALUES (?, ?, ?, ?, ?, ?)`,
        [item.name, item.category, item.description, item.price, item.ingredients, item.image]
      );
    }
  }

  const existingTables = await all('SELECT COUNT(*) as total FROM tables');
  if (existingTables[0].total === 0) {
    const seedTables = [
      { name: 'Mesa 01', capacity: 2, status: 'available' },
      { name: 'Mesa 02', capacity: 2, status: 'occupied' },
      { name: 'Mesa 03', capacity: 4, status: 'reserved' },
      { name: 'Mesa 04', capacity: 4, status: 'available' },
      { name: 'Mesa 05', capacity: 6, status: 'cleaning' },
    ];

    for (const table of seedTables) {
      await run(
        `INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)`,
        [table.name, table.capacity, table.status]
      );
    }
  }
}

async function getUserByUsername(username) {
  await createDb();
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

async function getCustomerByLogin(login) {
  await createDb();
  return get('SELECT * FROM customers WHERE login = ?', [login]);
}

async function createCustomer({ name, login, password, paymentKey }) {
  await createDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await run(
    `INSERT INTO customers (name, login, password_hash, payment_key, order_count) VALUES (?, ?, ?, ?, 0)`,
    [name, login, passwordHash, paymentKey || 'PAY-NEW']
  );
  return get('SELECT * FROM customers WHERE id = ?', [result.id]);
}

async function getCustomers() {
  await createDb();
  return all('SELECT * FROM customers ORDER BY created_at DESC');
}

async function createProduct(product) {
  await createDb();
  return run(
    `INSERT INTO menu_items (name, category, description, price, ingredients, image, flavors, sizes, dough_type, measure) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.name,
      product.category,
      product.description,
      Number(product.price),
      product.ingredients || '',
      product.image || '',
      product.flavors || '',
      product.sizes || '',
      product.doughType || '',
      product.measure || '',
    ]
  );
}

async function getMenuItems(category = null) {
  await createDb();
  if (category) {
    return all('SELECT * FROM menu_items WHERE active = 1 AND category = ? ORDER BY name ASC', [category]);
  }
  return all('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name ASC');
}

async function getTables() {
  await createDb();
  return all('SELECT * FROM tables ORDER BY id ASC');
}

async function createOrder({ customerId, customerName, customerLogin, deliveryLocation, paymentMethod, items, totalValue }) {
  await createDb();
  const orderResult = await run(
    `INSERT INTO orders (customer_id, customer_name, customer_login, status, delivery_location, payment_method, total_value) VALUES (?, ?, ?, 'em-preparo', ?, ?, ?)`,
    [customerId || null, customerName, customerLogin || null, deliveryLocation || 'Retirada no balcão', paymentMethod || 'pix', Number(totalValue || 0)]
  );

  for (const item of items || []) {
    await run(
      `INSERT INTO order_items (order_id, product_name, product_description, quantity, unit_price, item_total, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderResult.id, item.name, item.description || '', Number(item.quantity || 1), Number(item.price || 0), Number(item.itemTotal || item.quantity * item.price || 0), item.notes || '']
    );
  }

  if (customerId) {
    await run(`UPDATE customers SET order_count = order_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [customerId]);
  }

  return get('SELECT * FROM orders WHERE id = ?', [orderResult.id]);
}

async function getOrders() {
  await createDb();
  return all('SELECT * FROM orders ORDER BY created_at DESC');
}

async function updateOrderStatus(id, status) {
  await createDb();
  return run(
    `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id]
  );
}

async function getOrderItemsByOrder(orderId) {
  await createDb();
  return all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
}

async function getOrdersByCustomer(customerId) {
  await createDb();
  return all('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
}

async function updateTableStatus(id, status) {
  await createDb();
  return run(
    `UPDATE tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id]
  );
}

async function createTable({ name, capacity, status = 'available' }) {
  await createDb();
  return run(
    `INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)`,
    [name, capacity, status]
  );
}

async function closeDb() {
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      db = null;
      dbInstance = null;
      resolve();
    });
  });
}

module.exports = {
  createDb,
  seedData,
  getUserByUsername,
  getCustomerByLogin,
  createCustomer,
  getCustomers,
  createProduct,
  getMenuItems,
  getTables,
  createOrder,
  getOrders,
  updateOrderStatus,
  getOrderItemsByOrder,
  getOrdersByCustomer,
  updateTableStatus,
  createTable,
  closeDb,
};
