// Rotas publicas da vitrine: cardapio, dados da loja e acompanhamento.
const express = require('express');

const { getMenuItems, getExtras, getStoreSettings, getOrderByCode, getOrderItemsByOrder } = require('../db');
const { generatePixQrCode } = require('../pix');
const { handle, notFound } = require('../http/errors');
const { limiters } = require('../http/security');
const { publicBaseUrl } = require('../services/urls');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pizzaria-api' });
});

router.get(
  '/menu',
  handle('Erro ao buscar o cardápio.', async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    res.json(await getMenuItems(category));
  })
);

router.get(
  '/extras',
  handle('Erro ao buscar adicionais.', async (req, res) => {
    const extras = await getExtras({ activeOnly: true });
    res.json(extras.map(({ id, name, price, category }) => ({ id, name, price: Number(price), category })));
  })
);

// Versao publica do perfil da loja: expoe so o que o cardapio precisa.
// A chave Pix e os dados do titular ficam de fora de proposito.
router.get(
  '/store/public-settings',
  handle('Erro ao carregar dados da loja.', async (req, res) => {
    const settings = await getStoreSettings();
    if (!settings) {
      return res.json({ companyName: 'PL Pizza', isOpen: true, deliveryFee: 0, deliveryRule: 'fixed' });
    }

    return res.json({
      companyName: settings.company_name,
      logoUrl: settings.logo_url,
      phone: settings.phone,
      address: settings.address,
      isOpen: Boolean(Number(settings.is_open)),
      deliveryFee: Number(settings.delivery_fee || 0),
      deliveryRule: settings.delivery_rule || 'fixed',
      freeDeliveryMin: Number(settings.free_delivery_min ?? 80),
    });
  })
);

// QR code do proprio site, gerado no servidor.
router.get(
  '/store/qrcode',
  handle('Erro ao gerar QR code.', async (req, res) => {
    const siteUrl = publicBaseUrl(req);
    res.json({ url: siteUrl, dataUrl: await generatePixQrCode(siteUrl) });
  })
);

// Acompanhamento publico do pedido pelo codigo (balcao, cliente e chatbot).
// Quem tem so o codigo ve o andamento, nunca o endereco nem o nome completo.
router.get(
  '/orders/code/:code',
  limiters.tracking,
  handle('Erro ao consultar pedido.', async (req, res) => {
    const code = String(req.params.code || '').slice(0, 20);
    const order = await getOrderByCode(code);
    if (!order) {
      throw notFound('Pedido não encontrado com esse código.');
    }

    const items = await getOrderItemsByOrder(order.id);
    res.json({
      orderCode: order.order_code,
      status: order.status,
      customerName: String(order.customer_name || '').trim().split(/\s+/)[0] || 'Cliente',
      paymentMethod: order.payment_method,
      total: Number(order.total_value || 0),
      createdAt: order.created_at,
      items: items.map((item) => ({ name: item.product_name, quantity: item.quantity })),
    });
  })
);

module.exports = router;
