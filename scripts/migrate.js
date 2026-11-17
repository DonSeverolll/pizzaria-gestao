// Aplica as migracoes pendentes no banco configurado e mostra o resultado.
// Uso: npm run db:migrate   (respeita DB_PROVIDER / SUPABASE_DB_URL do .env)
//
// Atras do pooler do Supabase na porta 6543 (modo transacao), o script
// conecta pela 5432 do mesmo host (modo sessao), mais previsivel para DDL.
process.env.DB_SESSION_MODE = '1';

const { migrate, currentProvider, closeDb } = require('../backend/db');
const { prepareProvider } = require('../backend/db/connection');

(async () => {
  await prepareProvider();
  let warnings = 0;
  const applied = await migrate({
    log: (message) => console.log(message),
    warn: (message) => {
      warnings += 1;
      console.warn(`! ${message}`);
    },
  });
  console.log(
    applied.length
      ? `${applied.length} migracao(oes) aplicada(s) no ${currentProvider()}.`
      : `Banco ${currentProvider()} ja esta atualizado.`
  );
  if (warnings) {
    console.warn(`${warnings} aviso(s) acima: revise antes do proximo deploy.`);
  }
  await closeDb();
})().catch(async (error) => {
  console.error(error.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
