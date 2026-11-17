// Aplica as migracoes pendentes no banco configurado e mostra o resultado.
// Uso: npm run db:migrate   (respeita DB_PROVIDER / SUPABASE_DB_URL do .env)
const { migrate, currentProvider, closeDb } = require('../backend/db');
const { prepareProvider } = require('../backend/db/connection');

(async () => {
  await prepareProvider();
  const applied = await migrate({ log: (message) => console.log(message) });
  console.log(
    applied.length
      ? `${applied.length} migracao(oes) aplicada(s) no ${currentProvider()}.`
      : `Banco ${currentProvider()} ja esta atualizado.`
  );
  await closeDb();
})().catch(async (error) => {
  console.error(error.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
