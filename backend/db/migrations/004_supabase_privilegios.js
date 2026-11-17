// Completa a protecao da 003 no Supabase (padrao trazido do projeto do flat):
//
// - liga o RLS em qualquer tabela do usuario da conexao que ainda esteja sem;
// - tira de anon/authenticated o acesso as SEQUENCIAS (a 003 so tratou as
//   tabelas);
// - muda os privilegios PADRAO: tabela, sequencia ou funcao criada daqui em
//   diante por este usuario ja nasce sem GRANT para a API publica, mesmo que
//   alguem esqueca o RLS numa migracao futura.
//
// O backend conecta como dono das tabelas e nao e afetado. No SQLite nao ha
// nada a fazer.
async function up(ctx) {
  if (ctx.dialect !== 'postgres') {
    return;
  }

  const owned = await ctx.all(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
        AND pg_get_userbyid(c.relowner) = current_user`
  );
  for (const { name } of owned) {
    await ctx.exec(`ALTER TABLE public."${name.replace(/"/g, '')}" ENABLE ROW LEVEL SECURITY`);
  }

  await ctx.exec(`
    DO $$
    DECLARE
      papel TEXT;
    BEGIN
      FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
          EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', papel);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', papel);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', papel);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', papel);
        END IF;
      END LOOP;
    END
    $$
  `);
}

module.exports = { up };
