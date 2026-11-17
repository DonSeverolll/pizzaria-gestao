// Indices para as consultas mais frequentes do painel e do acompanhamento de
// pedidos. Nao sao UNIQUE de proposito: bancos antigos podem ter linhas
// repetidas e a migracao nao pode falhar no deploy por causa disso.
async function up(ctx) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders (order_code)',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders (payment_reference)',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders (customer_phone)',
    'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)',
    'CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id ON cash_movements (register_id)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient ON inventory_movements (ingredient_name)',
  ];

  for (const sql of indexes) {
    await ctx.exec(sql);
  }
}

module.exports = { up };
