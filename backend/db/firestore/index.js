// Camada de dados no Cloud Firestore, com as MESMAS funcoes e formatos de
// retorno da camada SQL (backend/db/repositories). Rotas e regras de negocio
// nao sabem qual banco esta por tras.
const { createDb, closeDb, migrate } = require('./lifecycle');
const { seedData } = require('./seed');

function sqlOnly(name) {
  return async () => {
    throw new Error(`${name}() so existe na camada SQL; com DB_PROVIDER=firestore use as funcoes dos repositorios.`);
  };
}

module.exports = {
  // Infraestrutura
  createDb,
  closeDb,
  migrate,
  seedData,
  currentProvider: () => 'firestore',
  run: sqlOnly('run'),
  get: sqlOnly('get'),
  all: sqlOnly('all'),
  // Dominios
  ...require('./repositories/people'),
  ...require('./repositories/catalog'),
  ...require('./repositories/orders'),
  ...require('./repositories/operations'),
  ...require('./repositories/reports'),
};
