// Supabase expoe o schema public pela API REST (PostgREST) para os papeis
// anon/authenticated. Este app fala com o banco por conexao direta, entao
// liga o Row Level Security sem politicas: a API publica deixa de enxergar
// as tabelas e o backend (dono das tabelas) continua com acesso normal.
//
// So afeta tabelas cujo dono e o usuario da conexao, para nunca bloquear o
// proprio backend. No SQLite nao ha nada a fazer.
async function up(ctx) {
  if (ctx.dialect !== 'postgres') {
    return;
  }

  const owned = await ctx.all(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user`
  );

  for (const { tablename } of owned) {
    await ctx.exec(`ALTER TABLE public."${tablename.replace(/"/g, '')}" ENABLE ROW LEVEL SECURITY`);
  }

  await ctx.exec(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
      END IF;
    END
    $$
  `);
}

module.exports = { up };
