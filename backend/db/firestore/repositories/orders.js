// Pedidos no Firestore. Os itens ficam dentro do proprio pedido (array
// "items"), entao nao ha mais "juntar itens" com uma segunda consulta.
//
// createOrder e uma transacao so: reserva o ID, garante o codigo PL-XXXXXX
// unico (documento orderCodes/{codigo}), soma no contador do cliente e
// atualiza a carteira pre-calculada do CRM (crmCustomers).
const crypto = require('node:crypto');

const { getDb, now, toRow, rowsOf, reserveId, docId, keyOf, FieldValue } = require('../client');
const { createDb } = require('../lifecycle');
const { incrementCustomerOrders } = require('./people');

const db = () => getDb();

const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORDER_CODE_LENGTH = 6;
const CODE_CANDIDATES = 4;

function randomCode() {
  let suffix = '';
  for (let i = 0; i < ORDER_CODE_LENGTH; i += 1) {
    suffix += ORDER_CODE_ALPHABET[crypto.randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `PL-${suffix}`;
}

// Mesma chave de cliente do CRM SQL: telefone, depois login, depois nome.
function crmKeyFor(order) {
  if (order.customer_phone) return `phone:${String(order.customer_phone).replace(/\D/g, '')}`;
  if (order.customer_login) return `login:${order.customer_login}`;
  return `name:${String(order.customer_name || 'Cliente').toLowerCase().trim()}`;
}

const newestFirst = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id;

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
  const createdAt = now();

  const id = await db().runTransaction(async (tx) => {
    // ---- Leituras (o Firestore exige todas antes de qualquer gravacao)
    const reserved = await reserveId(tx, 'orders');
    const candidates = Array.from({ length: CODE_CANDIDATES }, randomCode);
    const codeSnapshots = await Promise.all(candidates.map((code) => tx.get(db().collection('orderCodes').doc(code))));
    const freeIndex = codeSnapshots.findIndex((snapshot) => !snapshot.exists);
    const orderCode = freeIndex >= 0 ? candidates[freeIndex] : `PL-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const order = {
      id: reserved.id,
      customer_id: customerId || null,
      customer_name: customerName,
      customer_login: customerLogin || null,
      customer_phone: customerPhone || null,
      status,
      delivery_location: deliveryLocation || 'Retirada no balcão',
      payment_method: paymentMethod || 'pix',
      total_value: Number(totalValue || 0),
      payment_provider: paymentProvider || null,
      payment_reference: paymentReference || null,
      order_code: orderCode,
      notes: notes || null,
      origin,
      created_at: createdAt,
      updated_at: createdAt,
      items: (items || []).map((item, index) => ({
        id: index + 1,
        order_id: reserved.id,
        product_name: item.name,
        product_description: item.description || '',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.price || 0),
        item_total: Number(item.itemTotal || item.quantity * item.price || 0),
        notes: item.notes || '',
      })),
    };

    const crmKey = crmKeyFor(order);
    const crmRef = db().collection('crmCustomers').doc(keyOf(crmKey));
    const crm = await tx.get(crmRef);

    // ---- Gravacoes
    tx.set(db().collection('orders').doc(docId(order.id)), order);
    tx.create(db().collection('orderCodes').doc(orderCode), { orderId: order.id });
    if (customerId) {
      await incrementCustomerOrders(tx, customerId);
    }
    const current = crm.exists ? crm.data() : null;
    tx.set(
      crmRef,
      {
        key: crmKey,
        name: current?.name || order.customer_name || 'Cliente',
        phone: current?.phone || order.customer_phone || null,
        login: current?.login ?? order.customer_login ?? null,
        registered: current?.registered ?? false,
        orders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(order.total_value),
        lastOrderAt: createdAt,
        lastAddress: order.delivery_location || current?.lastAddress || null,
      },
      { merge: true }
    );
    reserved.commit();
    return order.id;
  });

  return getOrderById(id);
}

async function getOrders() {
  await createDb();
  return rowsOf(await db().collection('orders').orderBy('created_at', 'desc').get());
}

async function getOrderById(id) {
  await createDb();
  return toRow(await db().collection('orders').doc(docId(id)).get()) || undefined;
}

async function updateOrderStatus(id, status) {
  await createDb();
  const ref = db().collection('orders').doc(docId(id));
  if (!(await ref.get()).exists) return { changes: 0 };
  await ref.update({ status, updated_at: now() });
  return { changes: 1 };
}

async function updateOrderPaymentReference(id, paymentReference) {
  await createDb();
  const ref = db().collection('orders').doc(docId(id));
  if (!(await ref.get()).exists) return { changes: 0 };
  await ref.update({ payment_reference: paymentReference, updated_at: now() });
  return { changes: 1 };
}

async function getOrderByPaymentReference(paymentReference) {
  await createDb();
  const snapshot = await db().collection('orders').where('payment_reference', '==', paymentReference).limit(1).get();
  return snapshot.empty ? undefined : rowsOf(snapshot)[0];
}

// Muda o status so se o pedido ainda estiver aguardando pagamento: reenviar o
// mesmo aviso de pagamento nao pode reabrir pedido entregue ou cancelado.
async function changeIfAwaitingPayment(id, nextStatus) {
  await createDb();
  const ref = db().collection('orders').doc(docId(id));
  return db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.data().status !== 'aguardando-pagamento') {
      return false;
    }
    tx.update(ref, { status: nextStatus, updated_at: now() });
    return true;
  });
}

async function markOrderPaid(id) {
  return changeIfAwaitingPayment(id, 'em-preparo');
}

async function cancelUnpaidOrder(id) {
  return changeIfAwaitingPayment(id, 'cancelado');
}

async function cancelOrder(id) {
  return updateOrderStatus(id, 'cancelado');
}

async function getOrderItemsByOrder(orderId) {
  const order = await getOrderById(orderId);
  return order?.items || [];
}

// Os itens ja vem no pedido; mantido para as rotas nao mudarem.
async function attachItems(orders) {
  return orders.map((order) => ({ ...order, items: order.items || [] }));
}

async function getOrdersByCustomer(customerId) {
  await createDb();
  const snapshot = await db().collection('orders').where('customer_id', '==', Number(customerId)).get();
  return rowsOf(snapshot).sort(newestFirst);
}

async function getOrdersByPhoneOrName({ phone, name }) {
  await createDb();
  const query = phone
    ? db().collection('orders').where('customer_phone', '==', phone)
    : db().collection('orders').where('customer_name', '==', name);
  return rowsOf(await query.get()).sort(newestFirst);
}

async function getOrderByCode(orderCode) {
  await createDb();
  const code = String(orderCode || '').toUpperCase();
  if (!/^PL-[A-Z0-9]{1,12}$/.test(code)) return undefined;
  const pointer = await db().collection('orderCodes').doc(code).get();
  if (!pointer.exists) return undefined;
  return getOrderById(pointer.data().orderId);
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
  crmKeyFor,
};
