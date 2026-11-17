// Pedidos: criacao pela vitrine, painel da cozinha/atendimento, historico do
// cliente e venda no balcao (PDV).
const express = require('express');

const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  attachItems,
  getOrdersByCustomer,
  getCustomerByLogin,
  getCashRegister,
  addCashMovement,
} = require('../db');
const { authMiddleware, optionalAuth, requireAuth, requirePermission, hasPermission, isOwner } = require('../auth');
const { priceOrder } = require('../pricing');
const { handle, badRequest, notFound, HttpError } = require('../http/errors');
const { limiters } = require('../http/security');
const { cleanText, positiveId } = require('../http/validation');
const { prepareOrderFromRequest, assertStoreOpen } = require('../services/checkout');

const router = express.Router();

const ORDER_STATUSES = ['aguardando-pagamento', 'em-preparo', 'pronto', 'em-entrega', 'entregue', 'cancelado'];
const FINAL_STATUSES = ['entregue', 'cancelado'];
const PDV_PAYMENT_METHODS = ['dinheiro', 'pix', 'cartao'];

// Regras de transicao conferidas no servidor:
// - tirar um pedido de "aguardando pagamento" (exceto para cancelar) e
//   confirmar pagamento: exige a permissao "pagamentos" (caixa/gerente/dono);
// - reabrir pedido entregue ou cancelado: so o dono.
function assertTransitionAllowed(user, from, to) {
  if (from === to) return;

  if (from === 'aguardando-pagamento' && to !== 'cancelado' && !hasPermission(user.role, 'pagamentos')) {
    throw new HttpError(403, 'Seu perfil não pode confirmar pagamentos.');
  }

  if (FINAL_STATUSES.includes(from) && !isOwner(user.role)) {
    throw new HttpError(403, 'Apenas o dono pode reabrir um pedido finalizado.');
  }
}

router.get(
  '/orders',
  authMiddleware,
  requirePermission('pedidos'),
  handle('Erro ao buscar pedidos.', async (req, res) => {
    res.json(await attachItems(await getOrders()));
  })
);

router.patch(
  '/orders/:id/status',
  authMiddleware,
  requirePermission('pedidos'),
  handle('Erro ao atualizar status.', async (req, res) => {
    const id = positiveId(req.params.id);
    const { status } = req.body || {};

    if (!ORDER_STATUSES.includes(status)) {
      throw badRequest('Status inválido.');
    }

    const current = id ? await getOrderById(id) : null;
    if (!current) {
      throw notFound('Pedido não encontrado.');
    }

    assertTransitionAllowed(req.user, current.status, status);
    await updateOrderStatus(id, status);
    res.json(await getOrderById(id));
  })
);

router.get(
  '/me/orders',
  authMiddleware,
  requireAuth,
  handle('Erro ao buscar histórico do cliente.', async (req, res) => {
    const customer = req.user.role === 'customer' ? await getCustomerByLogin(req.user.username) : null;
    if (!customer) {
      throw notFound('Cliente não encontrado.');
    }

    res.json(await attachItems(await getOrdersByCustomer(customer.id)));
  })
);

// Pedido pago na entrega (dinheiro). Cartao e Pix online tem endpoints
// proprios que comecam em "aguardando pagamento": aqui o metodo e fixo para o
// pedido nao ir direto para a cozinha como se ja estivesse pago.
router.post(
  '/orders',
  limiters.orders,
  optionalAuth,
  handle('Erro ao criar pedido.', async (req, res) => {
    const { priced, orderBase } = await prepareOrderFromRequest(req);
    const order = await createOrder({ ...orderBase, paymentMethod: 'dinheiro' });
    res.status(201).json({ order, resumo: priced });
  })
);

// PDV: venda feita no balcao pelo atendente. Usa o mesmo calculo de preco da
// vitrine e ja lanca a entrada no caixa aberto, quando houver.
router.post(
  '/pdv/sale',
  authMiddleware,
  requirePermission('pdv'),
  handle('Erro ao registrar venda no balcão.', async (req, res) => {
    await assertStoreOpen();

    const { items, customerName, paymentMethod, notes } = req.body || {};
    const metodo = PDV_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'dinheiro';
    const priced = await priceOrder({ items, orderMode: 'local' });

    const order = await createOrder({
      customerName: cleanText(customerName, 80) || 'Venda no balcão',
      deliveryLocation: 'Consumo no local',
      paymentMethod: metodo,
      items: priced.items,
      totalValue: priced.total,
      status: 'em-preparo',
      paymentProvider: 'balcao',
      notes: cleanText(notes, 500),
      origin: 'balcao',
    });

    // Se existe caixa aberto, a venda entra nele automaticamente.
    let cashMovement = null;
    const register = await getCashRegister();
    if (register && register.status === 'open') {
      cashMovement = await addCashMovement({
        registerId: register.id,
        type: metodo === 'dinheiro' ? 'entrada' : metodo,
        amount: priced.total,
        method: metodo,
        description: `Venda balcão ${order.order_code}`,
      });
    }

    res.status(201).json({ order, resumo: priced, lancadoNoCaixa: Boolean(cashMovement) });
  })
);

module.exports = router;
