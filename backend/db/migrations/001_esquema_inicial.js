// Linha de base: o esquema que existia antes das migracoes versionadas.
//
// E idempotente de proposito (IF NOT EXISTS + addColumn) porque os bancos ja
// em uso, inclusive o de producao, foram criados pelo codigo antigo: aqui ela
// so completa o que faltar e registra a versao 001.
async function up(ctx) {
  const id = ctx.idColumn;

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${id},
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id ${id},
      name TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      payment_key TEXT,
      order_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id ${id},
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
      size_prices TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id ${id},
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id ${id},
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

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id ${id},
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

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id ${id},
      company_name TEXT NOT NULL DEFAULT 'PL Pizza',
      logo_url TEXT,
      phone TEXT,
      address TEXT,
      pix_key TEXT,
      is_open INTEGER NOT NULL DEFAULT 1,
      delivery_fee REAL NOT NULL DEFAULT 9.9,
      delivery_rule TEXT DEFAULT 'fixed',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS store_hours (
      id ${id},
      day_of_week INTEGER NOT NULL,
      open_time TEXT,
      close_time TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS cash_register (
      id ${id},
      status TEXT NOT NULL DEFAULT 'closed',
      opened_at TEXT,
      closed_at TEXT,
      opened_by TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      cash_total REAL NOT NULL DEFAULT 0,
      pix_total REAL NOT NULL DEFAULT 0,
      card_total REAL NOT NULL DEFAULT 0,
      withdrawals REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id ${id},
      register_id INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      method TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (register_id) REFERENCES cash_register(id)
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id ${id},
      ingredient_name TEXT UNIQUE NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      minimum_quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS product_extras (
      id ${id},
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      category TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id ${id},
      ingredient_name TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Colunas que o codigo antigo acrescentava em bancos ja existentes.
  await ctx.addColumn('menu_items', 'flavors', 'TEXT');
  await ctx.addColumn('menu_items', 'sizes', 'TEXT');
  await ctx.addColumn('menu_items', 'dough_type', 'TEXT');
  await ctx.addColumn('menu_items', 'measure', 'TEXT');
  await ctx.addColumn('menu_items', 'size_prices', 'TEXT');
  await ctx.addColumn('store_settings', 'pix_owner_name', 'TEXT');
  await ctx.addColumn('store_settings', 'pix_city', 'TEXT');
  await ctx.addColumn('store_settings', 'free_delivery_min', 'REAL');
  await ctx.addColumn('users', 'name', 'TEXT');
  await ctx.addColumn('users', 'created_at', 'TEXT');
  await ctx.addColumn('orders', 'payment_provider', 'TEXT');
  await ctx.addColumn('orders', 'payment_reference', 'TEXT');
  await ctx.addColumn('orders', 'order_code', 'TEXT');
  await ctx.addColumn('orders', 'customer_phone', 'TEXT');
  await ctx.addColumn('orders', 'notes', 'TEXT');
  await ctx.addColumn('orders', 'origin', 'TEXT');
}

module.exports = { up };
