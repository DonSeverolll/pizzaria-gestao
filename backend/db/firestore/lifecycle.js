// Ciclo de vida do Firestore: conecta e aplica os dados iniciais uma vez por
// processo. Nao ha migracoes de esquema (o Firestore nao tem esquema).
const { getDb, closeFirestore } = require('./client');
const { seedData } = require('./seed');

let ready = null;

async function createDb() {
  if (!ready) {
    ready = (async () => {
      getDb();
      await seedData();
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
  return { provider: 'firestore' };
}

async function closeDb() {
  ready = null;
  await closeFirestore();
}

// Compatibilidade com a camada SQL (npm run db:migrate): nada a aplicar.
async function migrate() {
  return [];
}

module.exports = { createDb, closeDb, migrate };
