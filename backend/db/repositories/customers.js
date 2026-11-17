// Clientes cadastrados na loja (tabela customers).
const bcrypt = require('bcryptjs');

const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');
const { BCRYPT_COST } = require('../seed');

// Nunca devolve password_hash nem payment_key para fora do backend.
const PUBLIC_COLUMNS = 'id, name, login, order_count, created_at, updated_at';

// Inclui password_hash: uso exclusivo do login e de quem precisa do id.
async function getCustomerByLogin(login) {
  await createDb();
  return get('SELECT * FROM customers WHERE login = ?', [login]);
}

async function createCustomer({ name, login, password, paymentKey }) {
  await createDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const result = await run(
    `INSERT INTO customers (name, login, password_hash, payment_key, order_count) VALUES (?, ?, ?, ?, 0)`,
    [name, login, passwordHash, paymentKey || 'PAY-NEW']
  );
  return get(`SELECT ${PUBLIC_COLUMNS} FROM customers WHERE id = ?`, [result.id]);
}

async function getCustomers() {
  await createDb();
  return all(`SELECT ${PUBLIC_COLUMNS} FROM customers ORDER BY created_at DESC`);
}

module.exports = {
  getCustomerByLogin,
  createCustomer,
  getCustomers,
};
