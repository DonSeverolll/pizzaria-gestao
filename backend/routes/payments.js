// Pagamentos online: Pix direto (QR Code da loja) e cartao via Mercado Pago.
const crypto = require('node:crypto');
const express = require('express');

const {
  createOrder,
  getOrderById,
  getStoreSettings,
  updateOrderPaymentReference,
  markOrderPaid,
  cancelUnpaidOrder,
  cancelOrder,
} = require('../db');
const { optionalAuth } = require('../auth');
const { buildPixPayload, generatePixQrCode } = require('../pix');
const { createPreference, getPayment } = require('../mercadopago');
const { handle, badRequest } = require('../http/errors');
const { limiters } = require('../http/security');
const { prepareOrderFromRequest } = require('../services/checkout');
const { publicBaseUrl } = require('../services/urls');

const router = express.Router();

router.post(
  '/payments/pix',
  limiters.orders,
  optionalAuth,
  handle('Erro ao gerar pagamento Pix.', async (req, res) => {
    const settings = await getStoreSettings();
    if (!settings?.pix_key) {
      throw badRequest('Chave Pix da loja ainda não foi configurada em Configurações.');
    }

    const { priced, orderBase } = await prepareOrderFromRequest(req);

    const order = await createOrder({
      ...orderBase,
      paymentMethod: 'pix',
      status: 'aguardando-pagamento',
      paymentProvider: 'pix-direto',
    });

    const pixPayload = buildPixPayload({
      pixKey: settings.pix_key,
      merchantName: settings.pix_owner_name || settings.company_name,
      merchantCity: settings.pix_city || 'BRASIL',
      amount: priced.total,
      txid: order.order_code ? order.order_code.replace('-', '') : `PEDIDO${order.id}`,
    });

    const qrCodeDataUrl = await generatePixQrCode(pixPayload);
    res.status(201).json({ order, pixPayload, qrCodeDataUrl, resumo: priced });
  })
);

router.post(
  '/payments/mercadopago/preference',
  limiters.orders,
  optionalAuth,
  handle('Erro ao iniciar pagamento com cartão.', async (req, res) => {
    const { priced, orderBase } = await prepareOrderFromRequest(req);

    const order = await createOrder({
      ...orderBase,
      paymentMethod: 'cartao',
      status: 'aguardando-pagamento',
      paymentProvider: 'mercadopago',
    });

    // A entrega vai como item para o total cobrado bater com o do pedido.
    const checkoutItems = [...priced.items];
    if (priced.deliveryFee > 0) {
      checkoutItems.push({ name: 'Taxa de entrega', quantity: 1, price: priced.deliveryFee });
    }

    const origin = publicBaseUrl(req);
    const preference = await createPreference({
      items: checkoutItems,
      orderId: order.id,
      backUrls: {
        success: `${origin}/?payment=success`,
        failure: `${origin}/?payment=failure`,
        pending: `${origin}/?payment=pending`,
      },
      notificationUrl: `${origin}/api/payments/mercadopago/webhook`,
    });

    await updateOrderPaymentReference(order.id, preference.id);
    res.status(201).json({ order, initPoint: preference.initPoint, resumo: priced });
  })
);

// Confere a assinatura x-signature do Mercado Pago (HMAC-SHA256 com a chave
// secreta do webhook, configurada em MERCADOPAGO_WEBHOOK_SECRET).
function isValidMercadoPagoSignature(req, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = String(req.get('x-signature') || '');
  const requestId = String(req.get('x-request-id') || '');

  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key?.trim(), rest.join('=').trim()];
    })
  );

  if (!parts.ts || !parts.v1) {
    return false;
  }

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const received = Buffer.from(parts.v1, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
}

let warnedMissingWebhookSecret = false;

router.post('/payments/mercadopago/webhook', async (req, res) => {
  const paymentId = String(req.body?.data?.id || req.query['data.id'] || req.query.id || '');

  // Notificacoes sem id de pagamento (outros topicos) so sao confirmadas.
  if (!/^\d{1,20}$/.test(paymentId)) {
    return res.status(200).json({ received: true });
  }

  if (process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    if (!isValidMercadoPagoSignature(req, paymentId)) {
      return res.status(401).json({ message: 'Assinatura inválida.' });
    }
  } else if (!warnedMissingWebhookSecret) {
    warnedMissingWebhookSecret = true;
    console.warn('[SEGURANCA] MERCADOPAGO_WEBHOOK_SECRET nao configurado: assinatura do webhook nao verificada.');
  }

  try {
    // O status vem sempre da API do Mercado Pago, nunca do corpo recebido.
    const payment = await getPayment(paymentId);
    const orderId = Number(payment.external_reference);
    const order = Number.isInteger(orderId) && orderId > 0 ? await getOrderById(orderId) : null;

    if (!order || order.payment_provider !== 'mercadopago') {
      return res.status(200).json({ received: true });
    }

    if (payment.status === 'approved') {
      const amountMatches = Math.abs(Number(payment.transaction_amount) - Number(order.total_value)) < 0.01;
      if (amountMatches && payment.currency_id === 'BRL') {
        await markOrderPaid(order.id);
      } else {
        console.warn(`[pagamento] Valor do pagamento ${paymentId} nao confere com o pedido ${order.id}; mantido aguardando.`);
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await cancelUnpaidOrder(order.id);
    } else if (payment.status === 'refunded' || payment.status === 'charged_back') {
      await cancelOrder(order.id);
    }
  } catch (error) {
    console.error('Erro ao processar webhook do Mercado Pago:', error.message);
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
