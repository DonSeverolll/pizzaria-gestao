// Roda a mesma suite de testes contra o emulador do Firestore.
// Uso: npm run test:firestore   (sobe o emulador, roda e derruba)
// (O nome nao comeca com "test-" para o node --test nao rodar este arquivo
// como se fosse um teste.)
//
// O "firebase emulators:exec" define FIRESTORE_EMULATOR_HOST e chama este
// script, que so troca o banco para o Firestore e executa `node --test`.
const { spawnSync } = require('node:child_process');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST nao definido: rode com "npm run test:firestore".');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DB_PROVIDER: 'firestore' },
});

process.exit(result.status ?? 1);
