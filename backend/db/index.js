// Ponto de entrada da camada de dados: `require('./backend/db')` continua
// expondo as mesmas funcoes de antes, agora organizadas por area em
// repositories/. Para criar uma tabela ou coluna, adicione uma migracao em
// migrations/ (veja migrate.js) em vez de mexer no esquema por aqui.
const { run, get, all, currentProvider } = require('./connection');
const { createDb, closeDb } = require('./lifecycle');
const { migrate } = require('./migrate');
const { seedData } = require('./seed');

module.exports = {
  // Infraestrutura
  createDb,
  closeDb,
  migrate,
  seedData,
  currentProvider,
  run,
  get,
  all,
  // Dominios
  ...require('./repositories/users'),
  ...require('./repositories/customers'),
  ...require('./repositories/products'),
  ...require('./repositories/orders'),
  ...require('./repositories/store'),
  ...require('./repositories/cash'),
  ...require('./repositories/inventory'),
  ...require('./repositories/reports'),
};
