// Ponto de entrada da camada de dados: `require('./backend/db')` expoe as
// mesmas funcoes qualquer que seja o banco.
//
//   DB_PROVIDER=firestore  -> Cloud Firestore (backend/db/firestore)
//   DB_PROVIDER=postgres   -> Postgres/Supabase (repositories/ + migracoes)
//   (padrao)               -> SQLite embutido no Node, para desenvolvimento
//
// Na camada SQL, para criar uma tabela ou coluna adicione uma migracao em
// migrations/ (veja migrate.js). No Firestore nao ha esquema.
const isFirestore = String(process.env.DB_PROVIDER || '').toLowerCase() === 'firestore';

function sqlLayer() {
  const { run, get, all, currentProvider } = require('./connection');
  const { createDb, closeDb } = require('./lifecycle');
  const { migrate } = require('./migrate');
  const { seedData } = require('./seed');

  return {
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
}

module.exports = isFirestore ? require('./firestore') : sqlLayer();
