// Cardapio (menu_items) e adicionais (product_extras).
const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');

async function createProduct(product) {
  await createDb();
  return run(
    `INSERT INTO menu_items (name, category, description, price, ingredients, image, flavors, sizes, dough_type, measure, size_prices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.name,
      product.category,
      product.description,
      Number(product.price),
      product.ingredients || '',
      product.image || '',
      product.flavors || '',
      product.sizes || '',
      product.doughType || '',
      product.measure || '',
      product.sizePrices ? JSON.stringify(product.sizePrices) : null,
    ]
  );
}

async function updateProduct(id, product) {
  await createDb();
  const current = await get('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (!current) {
    return null;
  }

  const merged = {
    name: product.name ?? current.name,
    category: product.category ?? current.category,
    description: product.description ?? current.description,
    price: product.price !== undefined ? Number(product.price) : current.price,
    ingredients: product.ingredients ?? current.ingredients,
    image: product.image ?? current.image,
    flavors: product.flavors ?? current.flavors,
    sizes: product.sizes ?? current.sizes,
    doughType: product.doughType ?? current.dough_type,
    measure: product.measure ?? current.measure,
    sizePrices: product.sizePrices !== undefined ? JSON.stringify(product.sizePrices) : current.size_prices,
    active: product.active !== undefined ? (product.active ? 1 : 0) : current.active,
  };

  await run(
    `UPDATE menu_items SET name = ?, category = ?, description = ?, price = ?, ingredients = ?, image = ?, flavors = ?, sizes = ?, dough_type = ?, measure = ?, size_prices = ?, active = ? WHERE id = ?`,
    [
      merged.name,
      merged.category,
      merged.description,
      merged.price,
      merged.ingredients,
      merged.image,
      merged.flavors,
      merged.sizes,
      merged.doughType,
      merged.measure,
      merged.sizePrices,
      merged.active,
      id,
    ]
  );

  return get('SELECT * FROM menu_items WHERE id = ?', [id]);
}

async function deleteProduct(id) {
  await createDb();
  return run('DELETE FROM menu_items WHERE id = ?', [id]);
}

async function getMenuItems(category = null) {
  await createDb();
  if (category) {
    return all('SELECT * FROM menu_items WHERE active = 1 AND category = ? ORDER BY name ASC', [category]);
  }
  return all('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name ASC');
}

async function getAllMenuItems() {
  await createDb();
  return all('SELECT * FROM menu_items ORDER BY category, name ASC');
}

async function getExtras({ activeOnly = false } = {}) {
  await createDb();
  if (activeOnly) {
    return all('SELECT * FROM product_extras WHERE active = 1 ORDER BY name ASC');
  }
  return all('SELECT * FROM product_extras ORDER BY name ASC');
}

async function createExtra({ name, price, category }) {
  await createDb();
  const result = await run(`INSERT INTO product_extras (name, price, category, active) VALUES (?, ?, ?, 1)`, [
    name,
    Number(price || 0),
    category || null,
  ]);
  return get('SELECT * FROM product_extras WHERE id = ?', [result.id]);
}

async function updateExtra(id, { name, price, category, active }) {
  await createDb();
  const current = await get('SELECT * FROM product_extras WHERE id = ?', [id]);
  if (!current) {
    return null;
  }

  await run(`UPDATE product_extras SET name = ?, price = ?, category = ?, active = ? WHERE id = ?`, [
    name ?? current.name,
    price !== undefined ? Number(price) : current.price,
    category ?? current.category,
    active !== undefined ? (active ? 1 : 0) : current.active,
    id,
  ]);

  return get('SELECT * FROM product_extras WHERE id = ?', [id]);
}

async function deleteExtra(id) {
  await createDb();
  return run('DELETE FROM product_extras WHERE id = ?', [id]);
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
};
