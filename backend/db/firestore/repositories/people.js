// Funcionarios (users) e clientes (customers) no Firestore.
//
// Logins unicos: alem do documento principal, cada login ocupa um documento
// "trava" (usernames/{login}, customerLogins/{login}) criado na mesma
// transacao. Se ja existir, a transacao falha e nada e gravado.
const bcrypt = require('bcryptjs');

const { getDb, now, toRow, rowsOf, reserveId, docId, keyOf, FieldValue } = require('../client');
const { createDb } = require('../lifecycle');
const { BCRYPT_COST } = require('../../seed');

const db = () => getDb();

function publicUser(row) {
  if (!row) return null;
  const { id, username, name, role, created_at } = row;
  return { id, username, name: name ?? null, role, created_at };
}

function publicCustomer(row) {
  if (!row) return null;
  const { id, name, login, order_count, created_at, updated_at } = row;
  return { id, name, login, order_count, created_at, updated_at };
}

// ------------------------------------------------------------ Funcionarios

// Inclui password_hash: uso exclusivo do login.
async function getUserByUsername(username) {
  await createDb();
  const snapshot = await db().collection('users').where('username', '==', String(username)).limit(1).get();
  return snapshot.empty ? undefined : rowsOf(snapshot)[0];
}

async function getUserById(id) {
  await createDb();
  return publicUser(toRow(await db().collection('users').doc(docId(id)).get())) || undefined;
}

async function listUsers() {
  await createDb();
  const rows = rowsOf(await db().collection('users').get());
  return rows.sort((a, b) => a.id - b.id).map(publicUser);
}

async function countOwners() {
  await createDb();
  const snapshot = await db().collection('users').where('role', 'in', ['dono', 'admin']).count().get();
  return Number(snapshot.data().count || 0);
}

async function createStaffUser({ username, password, name, role }) {
  await createDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const id = await db().runTransaction(async (tx) => {
    const reserved = await reserveId(tx, 'users');
    tx.create(db().collection('usernames').doc(keyOf(username)), { userId: reserved.id });
    tx.set(db().collection('users').doc(docId(reserved.id)), {
      id: reserved.id,
      username,
      password_hash: passwordHash,
      name: name || username,
      role,
      created_at: now(),
    });
    reserved.commit();
    return reserved.id;
  });

  return getUserById(id);
}

async function updateStaffUser(id, { name, role, password }) {
  await createDb();
  const ref = db().collection('users').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return null;
  }

  await ref.update({
    name: name ?? current.name,
    role: role ?? current.role,
    password_hash: password ? await bcrypt.hash(password, BCRYPT_COST) : current.password_hash,
  });

  return getUserById(id);
}

async function deleteStaffUser(id) {
  await createDb();
  const ref = db().collection('users').doc(docId(id));
  const current = toRow(await ref.get());
  if (!current) {
    return { changes: 0 };
  }
  const batch = db().batch();
  batch.delete(ref);
  batch.delete(db().collection('usernames').doc(keyOf(current.username)));
  await batch.commit();
  return { changes: 1 };
}

// --------------------------------------------------------------- Clientes

// Inclui password_hash: uso exclusivo do login e de quem precisa do id.
async function getCustomerByLogin(login) {
  await createDb();
  const snapshot = await db().collection('customers').where('login', '==', String(login)).limit(1).get();
  return snapshot.empty ? undefined : rowsOf(snapshot)[0];
}

async function createCustomer({ name, login, password, paymentKey }) {
  await createDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const createdAt = now();

  const id = await db().runTransaction(async (tx) => {
    const crmRef = db().collection('crmCustomers').doc(keyOf(`login:${login}`));
    const crm = await tx.get(crmRef);
    const reserved = await reserveId(tx, 'customers');

    tx.create(db().collection('customerLogins').doc(keyOf(login)), { customerId: reserved.id });
    tx.set(db().collection('customers').doc(docId(reserved.id)), {
      id: reserved.id,
      name,
      login,
      password_hash: passwordHash,
      payment_key: paymentKey || 'PAY-NEW',
      order_count: 0,
      created_at: createdAt,
      updated_at: createdAt,
    });
    // Entrada do CRM para o cliente cadastrado (mesmo sem pedidos).
    tx.set(
      crmRef,
      crm.exists
        ? { registered: true, name: crm.data().name || name }
        : {
            key: `login:${login}`,
            name,
            phone: null,
            login,
            registered: true,
            orders: 0,
            totalSpent: 0,
            lastOrderAt: null,
            lastAddress: null,
          },
      { merge: true }
    );
    reserved.commit();
    return reserved.id;
  });

  return publicCustomer(toRow(await db().collection('customers').doc(docId(id)).get()));
}

async function getCustomers() {
  await createDb();
  const rows = rowsOf(await db().collection('customers').get());
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(publicCustomer);
}

async function incrementCustomerOrders(tx, customerId) {
  tx.update(db().collection('customers').doc(docId(customerId)), {
    order_count: FieldValue.increment(1),
    updated_at: now(),
  });
}

module.exports = {
  getUserByUsername,
  getUserById,
  listUsers,
  countOwners,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  getCustomerByLogin,
  createCustomer,
  getCustomers,
  incrementCustomerOrders,
};
