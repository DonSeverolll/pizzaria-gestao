// Pedidos (orders) e seus itens (order_items).
const crypto = require('node:crypto');

const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');

// Sem 0/O e 1/I para nao gerar confusao quando o cliente le o codigo em voz
// alta no balcao.
const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 32^6 ~ 1 bilhao de combinacoes, sorteadas com gerador criptografico: o
// codigo e a unica "senha" do acompanhamento publico do pedido.
const ORDER_CODE_LENGTH = 6;

async function generateOrderCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < ORDER_CODE_LENGTH; i += 1) {
      suffix += ORDER_CODE_ALPHABET[crypto.randomInt(ORDER_CODE_ALPHABET.length)];
    }

    const code = `PL-${suffix}`;
    const existing = await get('SELECT id FROM orders WHERE order_code = ?', [code]);
    if (!existing) {
      return code;
    }
  }

  // Colidiu 10 vezes (praticamente impossivel): cai para algo garantidamente unico.
  return `PL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function createOrder({
  customerId,
  customerName,
  customerLogin,
  customerPhone,
  deliveryLocation,
  paymentMethod,
  items,
  totalValue,
  status = 'em-preparo',
  paymentProvider,
  paymentReference,
  notes,
  origin = 'site',
}) {
  await createDb();
  const orderCode = await generateOrderCode();
  const orderResult = await run(
    `INSERT INTO orders (customer_id, customer_name, customer_login, customer_phone, status, delivery_location, payment_method, total_value, payment_provider, payment_reference, order_code, notes, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId || null,
      customerName,
      customerLogin || null,
      customerPhone || null,
      status,
      deliveryLocation || 'Retirada no balcão',
      paymentMethod || 'pix',
      Number(totalValue || 0),
      paymentProvider || null,
      paymentReference || null,
      orderCode,
      notes || null,
      origin,
    ]
  );

  for (const item of items || []) {
    await run(
      `INSERT INTO order_items (order_id, product_name, product_description, quantity, unit_price, item_total, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderResult.id,
        item.name,
        item.description || '',
        Number(item.quantity || 1),
        Number(item.price || 0),
        Number(item.itemTotal || item.quantity * item.price || 0),
        item.notes || '',
      ]
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

async function getOrderById(id) {
  await createDb();
  return get('SELECT * FROM orders WHERE id = ?', [id]);
}

async function updateOrderStatus(id, status) {
  await createDb();
  return run(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
}

async function updateOrderPaymentReference(id, paymentReference) {
  await createDb();
  return run(`UPDATE orders SET payment_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [paymentReference, id]);
}

async function getOrderByPaymentReference(paymentReference) {
  await createDb();
  return get('SELECT * FROM orders WHERE payment_reference = ?', [paymentReference]);
}

// So libera para a cozinha quem ainda esta aguardando pagamento: reenviar o
// mesmo aviso de pagamento nao pode ressuscitar pedido entregue ou cancelado.
async function markOrderPaid(id) {
  await createDb();
  const result = await run(
    `UPDATE orders SET status = 'em-preparo', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'aguardando-pagamento'`,
    [id]
  );
  return result.changes > 0;
}

async function cancelUnpaidOrder(id) {
  await createDb();
  const result = await run(
    `UPDATE orders SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'aguardando-pagamento'`,
    [id]
  );
  return result.changes > 0;
}

async function cancelOrder(id) {
  return updateOrderStatus(id, 'cancelado');
}

async function getOrderItemsByOrder(orderId) {
  await createDb();
  return all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
}

// Junta os itens de varios pedidos numa unica consulta (evita N+1).
async function attachItems(orders) {
  await createDb();
  if (!orders.length) {
    return [];
  }

  const ids = orders.map((order) => order.id);
  const placeholders = ids.map(() => '?').join(', ');
  const items = await all(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`, ids);

  const byOrder = new Map(ids.map((id) => [id, []]));
  for (const item of items) {
    byOrder.get(item.order_id)?.push(item);
  }

  return orders.map((order) => ({ ...order, items: byOrder.get(order.id) || [] }));
}

async function getOrdersByCustomer(customerId) {
  await createDb();
  return all('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
}

async function getOrdersByPhoneOrName({ phone, name }) {
  await createDb();
  if (phone) {
    return all('SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC', [phone]);
  }
  return all('SELECT * FROM orders WHERE customer_name = ? ORDER BY created_at DESC', [name]);
}

async function getOrderByCode(orderCode) {
  await createDb();
  return get('SELECT * FROM orders WHERE order_code = ?', [String(orderCode || '').toUpperCase()]);
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentReference,
  getOrderByPaymentReference,
  markOrderPaid,
  cancelUnpaidOrder,
  cancelOrder,
  getOrderItemsByOrder,
  attachItems,
  getOrdersByCustomer,
  getOrdersByPhoneOrName,
  getOrderByCode,
};
