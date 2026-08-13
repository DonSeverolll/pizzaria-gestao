CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  payment_key TEXT,
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  ingredients TEXT,
  image TEXT,
  flavors TEXT,
  sizes TEXT,
  dough_type TEXT,
  measure TEXT,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_login TEXT,
  status TEXT NOT NULL DEFAULT 'em-preparo',
  delivery_location TEXT,
  payment_method TEXT,
  total_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  item_total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  ingredient_name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'perda')),
  quantity NUMERIC(10,2) NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_records (
  id SERIAL PRIMARY KEY,
  period TEXT NOT NULL,
  gross_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  losses NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_login ON customers(login);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(ingredient_name);

INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$2f734jN4kD8rE0jxV5f2nOhyJ9GLzwxRoq5nT2hx1jA8rB4mZb7oW', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO inventory (ingredient_name, unit, quantity, minimum_quantity)
VALUES
  ('Molho de tomate', 'unidade', 32, 10),
  ('Queijo mussarela', 'kg', 18, 5),
  ('Calabresa', 'kg', 10, 4),
  ('Frango', 'kg', 7, 3),
  ('Refrigerante', 'garrafa', 26, 8),
  ('Água', 'garrafa', 42, 12)
ON CONFLICT (ingredient_name) DO NOTHING;
