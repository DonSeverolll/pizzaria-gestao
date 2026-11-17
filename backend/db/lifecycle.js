// Ciclo de vida do banco: na primeira consulta escolhe o provedor, aplica as
// migracoes pendentes e os dados iniciais. Chamadas simultaneas compartilham
// a mesma inicializacao.
const { prepareProvider, currentProvider, closeConnections } = require('./connection');
const { migrate } = require('./migrate');
const { seedData } = require('./seed');

// Provedores ja migrados neste processo (o fallback local para SQLite e o
// Postgres podem alternar em desenvolvimento).
const readyByProvider = new Map();

async function initialize(provider) {
  await migrate({
    log: (message) => {
      if (!process.env.NODE_TEST_CONTEXT) console.log(`[db:${provider}] ${message}`);
    },
  });
  await seedData();
}

async function createDb() {
  const provider = await prepareProvider();

  if (!readyByProvider.has(provider)) {
    const ready = initialize(provider).catch((error) => {
      readyByProvider.delete(provider);
      throw error;
    });
    readyByProvider.set(provider, ready);
  }

  await readyByProvider.get(provider);
  return { provider: currentProvider() };
}

async function closeDb() {
  readyByProvider.clear();
  await closeConnections();
}

module.exports = {
  createDb,
  closeDb,
};
