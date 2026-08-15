const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

let client = null;

function getClient() {
  if (client) {
    return client;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Configure MERCADOPAGO_ACCESS_TOKEN no .env para habilitar pagamento com cartão.');
  }

  client = new MercadoPagoConfig({ accessToken });
  return client;
}

async function createPreference({ items, orderId, backUrls, notificationUrl }) {
  const preference = new Preference(getClient());

  const result = await preference.create({
    body: {
      items: items.map((item) => ({
        title: item.name,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.price || 0),
        currency_id: 'BRL',
      })),
      external_reference: String(orderId),
      back_urls: backUrls,
      // auto_return exige back_urls.success em HTTPS público; em dev local (http/localhost) o MP rejeita a preference inteira.
      ...(backUrls?.success?.startsWith('https://') ? { auto_return: 'approved' } : {}),
      notification_url: notificationUrl?.startsWith('https://') ? notificationUrl : undefined,
    },
  });

  return { id: result.id, initPoint: result.init_point };
}

async function getPayment(paymentId) {
  const payment = new Payment(getClient());
  return payment.get({ id: paymentId });
}

module.exports = {
  createPreference,
  getPayment,
};
