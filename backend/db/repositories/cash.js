// Caixa: abertura, movimentos e fechamento.
const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');

const CASH_MOVEMENT_TYPES = ['entrada', 'saida', 'pix', 'cartao'];

async function getCashRegister() {
  await createDb();
  const register = await get('SELECT * FROM cash_register ORDER BY id DESC LIMIT 1');
  if (!register) {
    return null;
  }

  const movements = await all('SELECT * FROM cash_movements WHERE register_id = ? ORDER BY created_at DESC', [register.id]);
  return { ...register, movements };
}

async function getCashRegisterById(id) {
  await createDb();
  return get('SELECT * FROM cash_register WHERE id = ?', [id]);
}

async function openCashRegister({ initialBalance = 0, openedBy = 'admin', notes = '' }) {
  await createDb();
  const latest = await get('SELECT * FROM cash_register ORDER BY id DESC LIMIT 1');
  if (latest && latest.status === 'open') {
    return latest;
  }

  const result = await run(
    `INSERT INTO cash_register (status, opened_at, opened_by, initial_balance, cash_total, pix_total, card_total, withdrawals, notes) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)`,
    ['open', new Date().toISOString(), openedBy, Number(initialBalance || 0), notes || '']
  );

  return getCashRegisterById(result.id);
}

async function addCashMovement({ registerId, type, amount, method = 'dinheiro', description = '' }) {
  await createDb();
  const movement = await run(
    `INSERT INTO cash_movements (register_id, type, amount, method, description) VALUES (?, ?, ?, ?, ?)`,
    [registerId, type, Number(amount || 0), method, description]
  );

  const register = await getCashRegisterById(registerId);
  if (!register) return movement;

  const value = Number(amount || 0);
  const next = {
    cash: Number(register.cash_total || 0) + (type === 'entrada' ? value : 0),
    pix: Number(register.pix_total || 0) + (type === 'pix' ? value : 0),
    card: Number(register.card_total || 0) + (type === 'cartao' ? value : 0),
    withdrawals: Number(register.withdrawals || 0) + (type === 'saida' ? value : 0),
  };

  await run(`UPDATE cash_register SET cash_total = ?, pix_total = ?, card_total = ?, withdrawals = ? WHERE id = ?`, [
    next.cash,
    next.pix,
    next.card,
    next.withdrawals,
    registerId,
  ]);

  return get('SELECT * FROM cash_movements WHERE id = ?', [movement.id]);
}

async function closeCashRegister({ registerId, notes = '' }) {
  await createDb();
  await run(`UPDATE cash_register SET status = 'closed', closed_at = ?, notes = ? WHERE id = ?`, [
    new Date().toISOString(),
    notes,
    registerId,
  ]);

  return getCashRegisterById(registerId);
}

module.exports = {
  CASH_MOVEMENT_TYPES,
  getCashRegister,
  getCashRegisterById,
  openCashRegister,
  addCashMovement,
  closeCashRegister,
};
