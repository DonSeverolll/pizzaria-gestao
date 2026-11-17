// Caixa e estoque no Firestore. Movimento e saldo sao gravados juntos, na
// mesma transacao (antes eram comandos SQL separados).
const { getDb, now, toRow, rowsOf, reserveId, docId, keyOf } = require('../client');
const { createDb } = require('../lifecycle');

const db = () => getDb();

const CASH_MOVEMENT_TYPES = ['entrada', 'saida', 'pix', 'cartao'];
const INVENTORY_MOVEMENT_TYPES = ['entrada', 'saida', 'ajuste', 'perda'];

const newestFirst = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id;

// ------------------------------------------------------------------- Caixa

async function latestRegister() {
  const snapshot = await db().collection('cashRegisters').orderBy('id', 'desc').limit(1).get();
  return snapshot.empty ? null : rowsOf(snapshot)[0];
}

async function getCashRegisterById(id) {
  await createDb();
  return toRow(await db().collection('cashRegisters').doc(docId(id)).get()) || undefined;
}

async function getCashRegister() {
  await createDb();
  const register = await latestRegister();
  if (!register) {
    return null;
  }
  const movements = rowsOf(
    await db().collection('cashRegisters').doc(docId(register.id)).collection('movements').get()
  ).sort(newestFirst);
  return { ...register, movements };
}

async function openCashRegister({ initialBalance = 0, openedBy = 'admin', notes = '' }) {
  await createDb();
  const latest = await latestRegister();
  if (latest && latest.status === 'open') {
    return latest;
  }

  const id = await db().runTransaction(async (tx) => {
    const reserved = await reserveId(tx, 'cashRegisters');
    tx.set(db().collection('cashRegisters').doc(docId(reserved.id)), {
      id: reserved.id,
      status: 'open',
      opened_at: new Date().toISOString(),
      closed_at: null,
      opened_by: openedBy,
      initial_balance: Number(initialBalance || 0),
      cash_total: 0,
      pix_total: 0,
      card_total: 0,
      withdrawals: 0,
      notes: notes || '',
      created_at: now(),
    });
    reserved.commit();
    return reserved.id;
  });

  return getCashRegisterById(id);
}

async function addCashMovement({ registerId, type, amount, method = 'dinheiro', description = '' }) {
  await createDb();
  const registerRef = db().collection('cashRegisters').doc(docId(registerId));
  const value = Number(amount || 0);

  const movementId = await db().runTransaction(async (tx) => {
    const registerSnapshot = await tx.get(registerRef);
    const reserved = await reserveId(tx, 'cashMovements');

    tx.set(registerRef.collection('movements').doc(docId(reserved.id)), {
      id: reserved.id,
      register_id: Number(registerId),
      type,
      amount: value,
      description,
      method,
      created_at: now(),
    });

    if (registerSnapshot.exists) {
      const register = registerSnapshot.data();
      tx.update(registerRef, {
        cash_total: Number(register.cash_total || 0) + (type === 'entrada' ? value : 0),
        pix_total: Number(register.pix_total || 0) + (type === 'pix' ? value : 0),
        card_total: Number(register.card_total || 0) + (type === 'cartao' ? value : 0),
        withdrawals: Number(register.withdrawals || 0) + (type === 'saida' ? value : 0),
      });
    }
    reserved.commit();
    return reserved.id;
  });

  return toRow(await registerRef.collection('movements').doc(docId(movementId)).get());
}

async function closeCashRegister({ registerId, notes = '' }) {
  await createDb();
  const ref = db().collection('cashRegisters').doc(docId(registerId));
  if ((await ref.get()).exists) {
    await ref.update({ status: 'closed', closed_at: new Date().toISOString(), notes });
  }
  return getCashRegisterById(registerId);
}

// ----------------------------------------------------------------- Estoque

async function getInventory() {
  await createDb();
  return rowsOf(await db().collection('inventory').get()).sort((a, b) =>
    String(a.ingredient_name).localeCompare(String(b.ingredient_name), 'pt-BR')
  );
}

async function getInventoryItem(id) {
  await createDb();
  return toRow(await db().collection('inventory').doc(docId(id)).get()) || undefined;
}

async function createInventoryItem({ ingredientName, unit, quantity = 0, minimumQuantity = 0 }) {
  await createDb();
  const id = await db().runTransaction(async (tx) => {
    const reserved = await reserveId(tx, 'inventory');
    // Nome unico, como a restricao UNIQUE do banco SQL.
    tx.create(db().collection('inventoryNames').doc(keyOf(ingredientName)), { itemId: reserved.id });
    tx.set(db().collection('inventory').doc(docId(reserved.id)), {
      id: reserved.id,
      ingredient_name: ingredientName,
      unit,
      quantity: Number(quantity || 0),
      minimum_quantity: Number(minimumQuantity || 0),
      updated_at: now(),
    });
    reserved.commit();
    return reserved.id;
  });
  return getInventoryItem(id);
}

async function updateInventoryItem(id, { unit, minimumQuantity }) {
  await createDb();
  const ref = db().collection('inventory').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return null;
  }
  await ref.update({
    unit: unit ?? current.unit,
    minimum_quantity: minimumQuantity !== undefined ? Number(minimumQuantity) : current.minimum_quantity,
    updated_at: now(),
  });
  return getInventoryItem(id);
}

async function deleteInventoryItem(id) {
  await createDb();
  const ref = db().collection('inventory').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return { changes: 0 };
  }
  // Leva junto o historico de movimentos (subcolecao) e a trava do nome.
  await db().recursiveDelete(ref);
  await db().collection('inventoryNames').doc(keyOf(current.ingredient_name)).delete();
  return { changes: 1 };
}

async function addInventoryMovement({ id, movementType, quantity, notes = '' }) {
  await createDb();
  const ref = db().collection('inventory').doc(docId(id));

  const updated = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      return false;
    }
    const reserved = await reserveId(tx, 'inventoryMovements');
    const item = snapshot.data();
    const delta = Number(quantity || 0);
    const signedDelta = movementType === 'saida' || movementType === 'perda' ? -delta : delta;

    tx.set(ref.collection('movements').doc(docId(reserved.id)), {
      id: reserved.id,
      ingredient_name: item.ingredient_name,
      movement_type: movementType,
      quantity: delta,
      notes,
      created_at: now(),
    });
    tx.update(ref, {
      quantity: Math.max(0, Number(item.quantity || 0) + signedDelta),
      updated_at: now(),
    });
    reserved.commit();
    return true;
  });

  return updated ? getInventoryItem(id) : null;
}

// Mantem a assinatura da camada SQL (busca pelo nome do ingrediente).
async function getInventoryMovements(ingredientName) {
  await createDb();
  const pointer = await db().collection('inventoryNames').doc(keyOf(ingredientName)).get();
  if (!pointer.exists) {
    return [];
  }
  const rows = rowsOf(
    await db().collection('inventory').doc(docId(pointer.data().itemId)).collection('movements').get()
  );
  return rows.sort(newestFirst).slice(0, 50);
}

module.exports = {
  CASH_MOVEMENT_TYPES,
  INVENTORY_MOVEMENT_TYPES,
  getCashRegister,
  getCashRegisterById,
  openCashRegister,
  addCashMovement,
  closeCashRegister,
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryMovement,
  getInventoryMovements,
};
