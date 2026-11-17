// Dados iniciais. So preenche tabelas vazias, entao pode rodar a cada boot.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const config = require('../config');
const { run, all } = require('./connection');

const BCRYPT_COST = 10;

async function isEmpty(table) {
  const rows = await all(`SELECT COUNT(*) as total FROM ${table}`);
  return Number(rows[0].total) === 0;
}

// Em producao nunca existe senha padrao conhecida: usa ADMIN_INITIAL_PASSWORD
// ou gera uma aleatoria, mostrada uma unica vez no log do primeiro boot.
function initialAdminPassword() {
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    return process.env.ADMIN_INITIAL_PASSWORD;
  }

  if (!config.isProduction) {
    return 'admin123';
  }

  const generated = crypto.randomBytes(12).toString('base64url');
  console.warn(
    `[SEGURANCA] Usuario "admin" criado com senha aleatoria: ${generated} — troque-a no painel ` +
      'ou defina ADMIN_INITIAL_PASSWORD antes do primeiro deploy.'
  );
  return generated;
}

const MENU_ITEMS = [
  { name: 'Calabresa', category: 'Pizzas Salgadas e Doces', description: 'Pizza grande de massa artesanal com calabresa, cebola e muçarela.', price: 30, ingredients: 'Calabresa, cebola, muçarela, molho de tomate', image: '🍕' },
  { name: 'Frango com Catupiry', category: 'Pizzas Salgadas e Doces', description: 'Frango desfiado, catupiry e sabor irresistível em cada pedaço.', price: 38, ingredients: 'Frango, catupiry, muçarela, cebola', image: '🍗' },
  { name: 'Portuguesa', category: 'Pizzas Salgadas e Doces', description: 'Presunto, ovos, cebola, azeitona e queijo derretido.', price: 36, ingredients: 'Presunto, ovos, cebola, azeitona, muçarela', image: '🍕' },
  { name: 'Margherita', category: 'Pizzas Salgadas e Doces', description: 'Molho de tomate, muçarela, manjericão e azeite.', price: 34, ingredients: 'Molho, muçarela, manjericão, azeite', image: '🌿' },
  { name: 'Pepperoni', category: 'Pizzas Salgadas e Doces', description: 'Pepperoni com muçarela e toque de pimenta calabresa.', price: 39, ingredients: 'Pepperoni, muçarela, pimenta', image: '🌶️' },
  { name: 'Chocolate com Morango', category: 'Pizzas Salgadas e Doces', description: 'Pizza doce com chocolate, morango e cobertura cremosa.', price: 35, ingredients: 'Chocolate, morango, leite condensado', image: '🍫' },
  { name: 'Banana com Canela', category: 'Pizzas Salgadas e Doces', description: 'Doçura equilibrada com banana, canela e cobertura.', price: 32, ingredients: 'Banana, canela, açúcar, leite condensado', image: '🍌' },
  { name: 'Guaraná de 1L', category: 'Bebidas', description: 'Super gelada para acompanhar sua pizza favorita.', price: 10, ingredients: 'Guaraná, gelo', image: '🥤' },
  { name: 'Água Mineral', category: 'Bebidas', description: 'Água super gelada, ideal para qualquer momento.', price: 2, ingredients: 'Água mineral', image: '💧' },
  { name: 'Pepsi 1L', category: 'Bebidas', description: 'Pepsi geladinha para acompanhar o sabor da pizza.', price: 10, ingredients: 'Pepsi, gelo', image: '🥤' },
  { name: 'H2OH Limoneto 500ml', category: 'Bebidas', description: 'Refrescante e cítrico, servido bem gelado.', price: 6, ingredients: 'Limoneto, água, gás', image: '🍋' },
  { name: 'Coca Cola de 1.5L', category: 'Bebidas', description: 'Garrafa de 1.5L, muito gelada e perfeita para dividir.', price: 13, ingredients: 'Coca-Cola, gás', image: '🥤' },
  { name: 'Coca Cola zero 1,5L', category: 'Bebidas', description: 'Versão zero açúcar, gelada e saborosa.', price: 13, ingredients: 'Coca-Cola Zero, gás', image: '🥤' },
];

const TABLES = [
  { name: 'Mesa 01', capacity: 2, status: 'available' },
  { name: 'Mesa 02', capacity: 2, status: 'occupied' },
  { name: 'Mesa 03', capacity: 4, status: 'reserved' },
  { name: 'Mesa 04', capacity: 4, status: 'available' },
  { name: 'Mesa 05', capacity: 6, status: 'cleaning' },
];

const STORE_HOURS = [
  { day_of_week: 1, open_time: '18:00', close_time: '23:30' },
  { day_of_week: 2, open_time: '18:00', close_time: '23:30' },
  { day_of_week: 3, open_time: '18:00', close_time: '23:30' },
  { day_of_week: 4, open_time: '18:00', close_time: '23:30' },
  { day_of_week: 5, open_time: '18:00', close_time: '00:00' },
  { day_of_week: 6, open_time: '18:00', close_time: '00:00' },
  { day_of_week: 0, open_time: '18:00', close_time: '23:00' },
];

const INVENTORY = [
  { name: 'Molho de tomate', unit: 'unidade', quantity: 32, minimum: 10 },
  { name: 'Queijo mussarela', unit: 'kg', quantity: 18, minimum: 5 },
  { name: 'Calabresa', unit: 'kg', quantity: 10, minimum: 4 },
  { name: 'Frango', unit: 'kg', quantity: 7, minimum: 3 },
  { name: 'Refrigerante', unit: 'garrafa', quantity: 26, minimum: 8 },
  { name: 'Água', unit: 'garrafa', quantity: 42, minimum: 12 },
];

// Os adicionais estavam fixos no HTML e saiam de graca. Entram aqui com um
// preco inicial que o dono deve revisar em Produtos > Adicionais.
const EXTRAS = [
  { name: 'Borda de catupiry', price: 8, category: 'Pizza' },
  { name: 'Borda de cheddar', price: 8, category: 'Pizza' },
  { name: 'Bacon extra', price: 7, category: 'Pizza' },
  { name: 'Queijo extra', price: 6, category: 'Pizza' },
];

async function seedData() {
  if (await isEmpty('users')) {
    const adminPassword = await bcrypt.hash(initialAdminPassword(), BCRYPT_COST);
    await run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`, ['admin', adminPassword]);
  }

  // Conta de cliente de demonstracao: so fora de producao, para nao deixar
  // um login com senha publica no site real.
  if (!config.isProduction) {
    const sampleCustomerPassword = await bcrypt.hash('cliente123', BCRYPT_COST);
    await run(
      `INSERT OR IGNORE INTO customers (name, login, password_hash, payment_key, order_count) VALUES (?, ?, ?, ?, 1)`,
      ['Cliente Demo', 'cliente', sampleCustomerPassword, 'PAY-1001']
    );
  }

  if (await isEmpty('menu_items')) {
    for (const item of MENU_ITEMS) {
      await run(
        `INSERT INTO menu_items (name, category, description, price, ingredients, image) VALUES (?, ?, ?, ?, ?, ?)`,
        [item.name, item.category, item.description, item.price, item.ingredients, item.image]
      );
    }
  }

  if (await isEmpty('tables')) {
    for (const table of TABLES) {
      await run(`INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)`, [table.name, table.capacity, table.status]);
    }
  }

  if (await isEmpty('store_settings')) {
    await run(
      `INSERT INTO store_settings (company_name, logo_url, phone, address, pix_key, is_open, delivery_fee, delivery_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['PL Pizza', '/logo-pl-real.png', '(99) 99999-9999', 'Rua das Pizzas, 123', 'plpizza@pix', 1, 9.9, 'fixed']
    );
  }

  if (await isEmpty('store_hours')) {
    for (const day of STORE_HOURS) {
      await run(`INSERT INTO store_hours (day_of_week, open_time, close_time, enabled) VALUES (?, ?, ?, 1)`, [
        day.day_of_week,
        day.open_time,
        day.close_time,
      ]);
    }
  }

  if (await isEmpty('inventory')) {
    for (const item of INVENTORY) {
      await run(`INSERT INTO inventory (ingredient_name, unit, quantity, minimum_quantity) VALUES (?, ?, ?, ?)`, [
        item.name,
        item.unit,
        item.quantity,
        item.minimum,
      ]);
    }
  }

  if (await isEmpty('product_extras')) {
    for (const extra of EXTRAS) {
      await run(`INSERT INTO product_extras (name, price, category, active) VALUES (?, ?, ?, 1)`, [
        extra.name,
        extra.price,
        extra.category,
      ]);
    }
  }
}

module.exports = { seedData, BCRYPT_COST };
