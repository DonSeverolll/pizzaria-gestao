// Estoque de ingredientes e historico de movimentos.
const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');

const INVENTORY_MOVEMENT_TYPES = ['entrada', 'saida', 'ajuste', 'perda'];

async function getInventory() {
  await createDb();
  return all('SELECT * FROM inventory ORDER BY ingredient_name ASC');
}

async function getInventoryItem(id) {
  await createDb();
  return get('SELECT * FROM inventory WHERE id = ?', [id]);
}

async function createInventoryItem({ ingredientName, unit, quantity = 0, minimumQuantity = 0 }) {
  await createDb();
  const result = await run(`INSERT INTO inventory (ingredient_name, unit, quantity, minimum_quantity) VALUES (?, ?, ?, ?)`, [
    ingredientName,
    unit,
    Number(quantity || 0),
    Number(minimumQuantity || 0),
  ]);
  return getInventoryItem(result.id);
}

async function updateInventoryItem(id, { unit, minimumQuantity }) {
  await createDb();
  const current = await getInventoryItem(id);
  if (!current) {
    return null;
  }

  await run(`UPDATE inventory SET unit = ?, minimum_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    unit ?? current.unit,
    minimumQuantity !== undefined ? Number(minimumQuantity) : current.minimum_quantity,
    id,
  ]);

  return getInventoryItem(id);
}

async function deleteInventoryItem(id) {
  await createDb();
  return run('DELETE FROM inventory WHERE id = ?', [id]);
}

async function addInventoryMovement({ id, movementType, quantity, notes = '' }) {
  await createDb();
  const item = await getInventoryItem(id);
  if (!item) {
    return null;
  }

  const delta = Number(quantity || 0);
  const signedDelta = movementType === 'saida' || movementType === 'perda' ? -delta : delta;
  const nextQuantity = Math.max(0, Number(item.quantity || 0) + signedDelta);

  await run(`INSERT INTO inventory_movements (ingredient_name, movement_type, quantity, notes) VALUES (?, ?, ?, ?)`, [
    item.ingredient_name,
    movementType,
    delta,
    notes,
  ]);

  await run(`UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [nextQuantity, id]);

  return getInventoryItem(id);
}

async function getInventoryMovements(ingredientName) {
  await createDb();
  return all('SELECT * FROM inventory_movements WHERE ingredient_name = ? ORDER BY created_at DESC LIMIT 50', [ingredientName]);
}

module.exports = {
  INVENTORY_MOVEMENT_TYPES,
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryMovement,
  getInventoryMovements,
};
