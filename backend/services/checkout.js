// Regras compartilhadas por todo endpoint que cria pedido (site, Pix, cartao
// e balcao): loja aberta, preco calculado no servidor e dados do cliente
// limpos antes de gravar.
const { getStoreSettings, getCustomerByLogin } = require('../db');
const { priceOrder } = require('../pricing');
const { HttpError } = require('../http/errors');
const { cleanText, cleanPhone } = require('../http/validation');

const STORE_CLOSED_MESSAGE = 'A loja está fechada no momento e não pode receber pedidos.';

const DELIVERY_LOCATION_BY_MODE = {
  retirada: 'Retirada no balcão',
  local: 'Consumo no local',
};

// A trava de loja fechada no navegador pode ser contornada, entao todo
// endpoint que cria pedido confirma o status no servidor antes de gravar.
async function isStoreOpen() {
  const settings = await getStoreSettings();
  return settings ? Boolean(Number(settings.is_open)) : true;
}

async function assertStoreOpen() {
  if (!(await isStoreOpen())) {
    throw new HttpError(409, STORE_CLOSED_MESSAGE);
  }
}

// Monta o pedido a partir da requisicao com os precos calculados no servidor.
// Usado pelos meios de pagamento para nao duplicar regra de negocio.
async function prepareOrderFromRequest(req) {
  await assertStoreOpen();

  const body = req.body || {};
  const priced = await priceOrder({ items: body.items, orderMode: body.orderMode });

  // Login vem so do token: o navegador nao escolhe em nome de quem compra.
  const customer = req.user?.role === 'customer' ? await getCustomerByLogin(req.user.username) : null;

  // Fora do delivery o endereco e fixo, para retirada nao "virar" entrega gratis.
  const deliveryLocation =
    DELIVERY_LOCATION_BY_MODE[priced.orderMode] || cleanText(body.deliveryLocation, 300) || 'Entrega em domicílio';

  return {
    priced,
    orderBase: {
      customerId: customer?.id || null,
      customerName: cleanText(body.customerName, 80) || customer?.name || 'Cliente',
      customerLogin: customer?.login || null,
      customerPhone: cleanPhone(body.customerPhone),
      deliveryLocation,
      notes: cleanText(body.notes, 500),
      items: priced.items,
      totalValue: priced.total,
    },
  };
}

module.exports = {
  STORE_CLOSED_MESSAGE,
  isStoreOpen,
  assertStoreOpen,
  prepareOrderFromRequest,
};
