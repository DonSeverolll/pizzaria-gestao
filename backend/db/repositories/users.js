// Funcionarios do painel (tabela users).
const bcrypt = require('bcryptjs');

const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');
const { BCRYPT_COST } = require('../seed');

const PUBLIC_COLUMNS = 'id, username, name, role, created_at';

// Inclui password_hash: uso exclusivo do login.
async function getUserByUsername(username) {
  await createDb();
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

async function getUserById(id) {
  await createDb();
  return get(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]);
}

async function listUsers() {
  await createDb();
  return all(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY id ASC`);
}

async function countOwners() {
  await createDb();
  const row = await get(`SELECT COUNT(*) as total FROM users WHERE role IN ('dono', 'admin')`);
  return Number(row?.total || 0);
}

async function createStaffUser({ username, password, name, role }) {
  await createDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const result = await run(`INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)`, [
    username,
    passwordHash,
    name || username,
    role,
  ]);
  return getUserById(result.id);
}

async function updateStaffUser(id, { name, role, password }) {
  await createDb();
  const current = await get('SELECT * FROM users WHERE id = ?', [id]);
  if (!current) {
    return null;
  }

  const passwordHash = password ? await bcrypt.hash(password, BCRYPT_COST) : current.password_hash;

  await run(`UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?`, [
    name ?? current.name,
    role ?? current.role,
    passwordHash,
    id,
  ]);

  return getUserById(id);
}

async function deleteStaffUser(id) {
  await createDb();
  return run('DELETE FROM users WHERE id = ?', [id]);
}

module.exports = {
  getUserByUsername,
  getUserById,
  listUsers,
  countOwners,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
};
