// Cardapio (menuItems), adicionais (extras), mesas e perfil da loja no
// Firestore. Sao colecoes pequenas: filtros e ordenacao rodam em memoria,
// sem exigir indices compostos.
const { getDb, now, toRow, rowsOf, reserveId, docId } = require('../client');
const { createDb } = require('../lifecycle');

const db = () => getDb();

const byText = (field) => (a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'pt-BR');
const byCategoryThenName = (a, b) => byText('category')(a, b) || byText('name')(a, b);

async function createWithId(collection, buildDoc) {
  return db().runTransaction(async (tx) => {
    const reserved = await reserveId(tx, collection);
    tx.set(db().collection(collection).doc(docId(reserved.id)), { id: reserved.id, ...buildDoc() });
    reserved.commit();
    return reserved.id;
  });
}

async function deleteById(collection, id) {
  const ref = db().collection(collection).doc(docId(id));
  const exists = (await ref.get()).exists;
  if (exists) await ref.delete();
  return { changes: exists ? 1 : 0 };
}

// ---------------------------------------------------------------- Produtos

async function createProduct(product) {
  await createDb();
  const id = await createWithId('menuItems', () => ({
    name: product.name,
    category: product.category,
    description: product.description ?? null,
    price: Number(product.price),
    ingredients: product.ingredients || '',
    image: product.image || '',
    flavors: product.flavors || '',
    sizes: product.sizes || '',
    dough_type: product.doughType || '',
    measure: product.measure || '',
    // Mantido como texto JSON, igual ao banco SQL: o front e o calculo de
    // preco ja leem esse formato.
    size_prices: product.sizePrices ? JSON.stringify(product.sizePrices) : null,
    active: 1,
  }));
  return { id, changes: 1 };
}

async function updateProduct(id, product) {
  await createDb();
  const ref = db().collection('menuItems').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return null;
  }

  await ref.update({
    name: product.name ?? current.name,
    category: product.category ?? current.category,
    description: product.description ?? current.description,
    price: product.price !== undefined ? Number(product.price) : current.price,
    ingredients: product.ingredients ?? current.ingredients,
    image: product.image ?? current.image,
    flavors: product.flavors ?? current.flavors,
    sizes: product.sizes ?? current.sizes,
    dough_type: product.doughType ?? current.dough_type,
    measure: product.measure ?? current.measure,
    size_prices: product.sizePrices !== undefined ? JSON.stringify(product.sizePrices) : current.size_prices,
    active: product.active !== undefined ? (product.active ? 1 : 0) : current.active,
  });

  return toRow(await ref.get());
}

async function deleteProduct(id) {
  await createDb();
  return deleteById('menuItems', id);
}

async function getAllMenuItems() {
  await createDb();
  return rowsOf(await db().collection('menuItems').get()).sort(byCategoryThenName);
}

async function getMenuItems(category = null) {
  const items = (await getAllMenuItems()).filter((item) => Number(item.active) === 1);
  if (category) {
    return items.filter((item) => item.category === category).sort(byText('name'));
  }
  return items;
}

// --------------------------------------------------------------- Adicionais

async function getExtras({ activeOnly = false } = {}) {
  await createDb();
  const extras = rowsOf(await db().collection('extras').get()).sort(byText('name'));
  return activeOnly ? extras.filter((extra) => Number(extra.active) === 1) : extras;
}

async function createExtra({ name, price, category }) {
  await createDb();
  const id = await createWithId('extras', () => ({
    name,
    price: Number(price || 0),
    category: category || null,
    active: 1,
    created_at: now(),
  }));
  return toRow(await db().collection('extras').doc(docId(id)).get());
}

async function updateExtra(id, { name, price, category, active }) {
  await createDb();
  const ref = db().collection('extras').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return null;
  }

  await ref.update({
    name: name ?? current.name,
    price: price !== undefined ? Number(price) : current.price,
    category: category ?? current.category,
    active: active !== undefined ? (active ? 1 : 0) : current.active,
  });
  return toRow(await ref.get());
}

async function deleteExtra(id) {
  await createDb();
  return deleteById('extras', id);
}

// ------------------------------------------------------------------- Mesas

async function getTables() {
  await createDb();
  return rowsOf(await db().collection('tables').get()).sort((a, b) => a.id - b.id);
}

async function createTable({ name, capacity, status = 'available' }) {
  await createDb();
  const id = await createWithId('tables', () => ({ name, capacity, status, updated_at: now() }));
  return { id, changes: 1 };
}

async function updateTableStatus(id, status) {
  await createDb();
  const ref = db().collection('tables').doc(docId(id));
  if (!(await ref.get()).exists) return { changes: 0 };
  await ref.update({ status, updated_at: now() });
  return { changes: 1 };
}

// ------------------------------------------------------------- Loja/horario

async function getStoreSettings() {
  await createDb();
  return toRow(await db().collection('settings').doc('store').get());
}

async function saveStoreSettings(settings) {
  await createDb();
  await db()
    .collection('settings')
    .doc('store')
    .set(
      {
        id: 1,
        company_name: settings.companyName || 'PL Pizza',
        logo_url: settings.logoUrl || '/logo-pl-real.png',
        phone: settings.phone || '',
        address: settings.address || '',
        pix_key: settings.pixKey || '',
        pix_owner_name: settings.pixOwnerName || '',
        pix_city: settings.pixCity || '',
        is_open: settings.isOpen ? 1 : 0,
        delivery_fee: Number(settings.deliveryFee || 0),
        delivery_rule: settings.deliveryRule || 'fixed',
        free_delivery_min: Number(settings.freeDeliveryMin ?? 80),
        updated_at: now(),
      },
      { merge: true }
    );
  return getStoreSettings();
}

async function getStoreHours() {
  await createDb();
  const snapshot = await db().collection('settings').doc('hours').get();
  const hours = snapshot.exists ? toRow(snapshot).hours || [] : [];
  return hours.sort((a, b) => a.day_of_week - b.day_of_week);
}

async function saveStoreHours(hours) {
  await createDb();
  const createdAt = now();
  await db()
    .collection('settings')
    .doc('hours')
    .set({
      hours: (hours || []).map((entry, index) => ({
        id: index + 1,
        day_of_week: Number(entry.dayOfWeek),
        open_time: entry.openTime || '18:00',
        close_time: entry.closeTime || '23:00',
        enabled: entry.enabled ? 1 : 0,
        created_at: createdAt,
      })),
    });
  return getStoreHours();
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getMenuItems,
  getAllMenuItems,
  getExtras,
  createExtra,
  updateExtra,
  deleteExtra,
  getTables,
  createTable,
  updateTableStatus,
  getStoreSettings,
  saveStoreSettings,
  getStoreHours,
  saveStoreHours,
};
