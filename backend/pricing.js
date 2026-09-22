const { getAllMenuItems, getExtras, getStoreSettings } = require('./db');

// O preco NUNCA pode vir do navegador: o cliente enviaria o valor que quisesse.
// Aqui so chegam identificadores, e todo valor e lido do banco.

function resolveUnitPrice(product, size) {
  if (size && product.size_prices) {
    try {
      const sizePrices = JSON.parse(product.size_prices);
      const chosen = sizePrices[size];
      if (chosen !== undefined && chosen !== null && chosen !== '') {
        return Number(chosen);
      }
    } catch (error) {
      // size_prices invalido no banco: cai para o preco base.
    }
  }

  return Number(product.price || 0);
}

// As categorias variam entre singular e plural ("Pizza"/"Pizzas"); normaliza
// acento, caixa e plural. Mesma regra em public/app.js.
function normalizeCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/s$/, '');
}

function extraAppliesTo(extra, product) {
  return !extra.category || normalizeCategory(extra.category) === normalizeCategory(product.category);
}

function describeItem({ size, dough, extras }) {
  return [
    size ? `Tamanho ${size}` : null,
    dough || null,
    extras.length ? extras.map((extra) => extra.name).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

async function priceOrder({ items: rawItems, orderMode = 'delivery' }) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Pedido vazio.');
  }

  const [products, extras, settings] = await Promise.all([
    getAllMenuItems(),
    getExtras({ activeOnly: true }),
    getStoreSettings(),
  ]);

  const productById = new Map(products.map((product) => [Number(product.id), product]));
  const extraById = new Map(extras.map((extra) => [Number(extra.id), extra]));

  const items = [];

  for (const raw of rawItems) {
    const product = productById.get(Number(raw.productId));
    if (!product) {
      throw new Error('Um dos itens do pedido não está mais no cardápio.');
    }

    if (!Number(product.active ?? 1)) {
      throw new Error(`"${product.name}" está esgotado no momento.`);
    }

    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    const chosenExtras = (Array.isArray(raw.extras) ? raw.extras : [])
      .map((id) => extraById.get(Number(id)))
      .filter(Boolean)
      .filter((extra) => extraAppliesTo(extra, product));

    const extrasTotal = chosenExtras.reduce((sum, extra) => sum + Number(extra.price || 0), 0);
    const unitPrice = resolveUnitPrice(product, raw.size) + extrasTotal;

    items.push({
      name: product.name,
      description: describeItem({ size: raw.size, dough: raw.dough, extras: chosenExtras }),
      quantity,
      price: unitPrice,
      itemTotal: unitPrice * quantity,
      notes: String(raw.notes || '').slice(0, 200),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);

  // Retirada e consumo no local nao pagam entrega.
  const configuredFee = Number(settings?.delivery_fee || 0);
  const freeFrom = Number(settings?.free_delivery_min ?? 80);
  const chargesDelivery = orderMode === 'delivery' && !(freeFrom > 0 && subtotal >= freeFrom);
  const deliveryFee = chargesDelivery ? configuredFee : 0;

  return {
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  };
}

module.exports = {
  priceOrder,
  resolveUnitPrice,
};
