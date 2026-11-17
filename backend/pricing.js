const { getAllMenuItems, getExtras, getStoreSettings } = require('./db');

// O preco NUNCA pode vir do navegador: o cliente enviaria o valor que quisesse.
// Aqui so chegam identificadores, e todo valor e lido do banco. Tudo o que vem
// do navegador (tamanho, massa, quantidade) e conferido contra o cadastro.

const MAX_QUANTITY_PER_ITEM = 50;
const MAX_ITEMS_PER_ORDER = 60;
const ORDER_MODES = ['delivery', 'retirada', 'local'];

function pricingError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseSizePrices(product) {
  if (!product.size_prices) {
    return null;
  }
  try {
    const parsed = JSON.parse(product.size_prices);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // size_prices invalido no banco: trata como produto sem tamanhos.
    return null;
  }
}

// Usa so chaves proprias do mapa: "constructor" ou "__proto__" nao podem
// virar preco (antes davam NaN e zeravam o total do pedido).
function resolveUnitPrice(product, size) {
  const sizePrices = parseSizePrices(product);
  if (size && sizePrices && Object.hasOwn(sizePrices, size)) {
    const chosen = sizePrices[size];
    if (chosen !== null && chosen !== '' && Number.isFinite(Number(chosen))) {
      return Number(chosen);
    }
  }

  return Number(product.price || 0);
}

function validateSize(product, size) {
  if (size === undefined || size === null || size === '') {
    return null;
  }

  const sizePrices = parseSizePrices(product);
  const value = String(size);
  if (!sizePrices || !Object.hasOwn(sizePrices, value) || sizePrices[value] === null || sizePrices[value] === '') {
    throw pricingError(`Tamanho indisponível para "${product.name}".`);
  }
  return value;
}

function validateDough(product, dough) {
  if (dough === undefined || dough === null || dough === '') {
    return null;
  }

  const options = String(product.dough_type || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const value = String(dough).trim();
  if (!options.includes(value)) {
    throw pricingError(`Opção de massa indisponível para "${product.name}".`);
  }
  return value;
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

function normalizeOrderMode(orderMode) {
  return ORDER_MODES.includes(orderMode) ? orderMode : 'delivery';
}

async function priceOrder({ items: rawItems, orderMode = 'delivery' }) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw pricingError('Pedido vazio.');
  }

  if (rawItems.length > MAX_ITEMS_PER_ORDER) {
    throw pricingError('Pedido com itens demais.');
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
    const product = productById.get(Number(raw?.productId));
    if (!product) {
      throw pricingError('Um dos itens do pedido não está mais no cardápio.');
    }

    if (!Number(product.active ?? 1)) {
      throw pricingError(`"${product.name}" está esgotado no momento.`);
    }

    const size = validateSize(product, raw.size);
    const dough = validateDough(product, raw.dough);
    const requested = Math.floor(Number(raw.quantity) || 1);
    const quantity = Math.min(MAX_QUANTITY_PER_ITEM, Math.max(1, Number.isFinite(requested) ? requested : 1));
    const chosenExtras = [...new Set(Array.isArray(raw.extras) ? raw.extras.map(Number) : [])]
      .map((id) => extraById.get(id))
      .filter(Boolean)
      .filter((extra) => extraAppliesTo(extra, product));

    const extrasTotal = chosenExtras.reduce((sum, extra) => sum + Number(extra.price || 0), 0);
    const unitPrice = resolveUnitPrice(product, size) + extrasTotal;

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw pricingError(`"${product.name}" está sem preço válido no cardápio.`);
    }

    items.push({
      name: product.name,
      description: describeItem({ size, dough, extras: chosenExtras }),
      quantity,
      price: unitPrice,
      itemTotal: unitPrice * quantity,
      notes: String(raw.notes || '').slice(0, 200),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
  const mode = normalizeOrderMode(orderMode);

  // Retirada e consumo no local nao pagam entrega.
  const configuredFee = Number(settings?.delivery_fee || 0);
  const freeFrom = Number(settings?.free_delivery_min ?? 80);
  const chargesDelivery = mode === 'delivery' && !(freeFrom > 0 && subtotal >= freeFrom);
  const deliveryFee = chargesDelivery ? configuredFee : 0;
  const total = subtotal + deliveryFee;

  if (!Number.isFinite(total) || total <= 0) {
    throw pricingError('Não foi possível calcular o total do pedido.');
  }

  return {
    items,
    subtotal,
    deliveryFee,
    total,
    orderMode: mode,
  };
}

module.exports = {
  priceOrder,
  resolveUnitPrice,
  normalizeOrderMode,
  ORDER_MODES,
};
