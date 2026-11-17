// Conexao com o banco de dados.
//
// - Desenvolvimento e testes: SQLite embutido no proprio Node (node:sqlite),
//   sem modulo nativo para compilar nem dependencias de build vulneraveis.
// - Producao (Vercel): Postgres/Supabase via SUPABASE_DB_URL ou DATABASE_URL.
//
// Todo acesso passa por run/get/all com SQL no estilo SQLite ("?" como
// parametro). No Postgres o SQL e convertido ($1, $2..., RETURNING id).
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const config = require('../config');

const POSTGRES_RETRY_MS = 15000;
// Depois de um SELECT 1 bem-sucedido, nao repete a checagem a cada consulta.
const POSTGRES_HEALTHCHECK_MS = 10000;

function postgresConnectionString() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
}

// O pooler do Supabase atende em modo transacao na porta 6543 e em modo
// sessao na 5432. Scripts de manutencao (npm run db:migrate) usam o modo
// sessao, mais previsivel para DDL. Compara host e porta de verdade, em vez
// de procurar texto na URL (a senha poderia conter ":6543").
function sessionModeUrl(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return url;
  }
  const isPooler = target.hostname === 'pooler.supabase.com' || target.hostname.endsWith('.pooler.supabase.com');
  if (!isPooler || target.port !== '6543') {
    return url;
  }
  target.port = '5432';
  console.log('[db] Pooler em modo transacao detectado: usando a porta 5432 (modo sessao).');
  return target.toString();
}

function hasUsablePostgresConnection() {
  const connectionString = postgresConnectionString();
  return Boolean(connectionString) && !connectionString.includes('YOUR-PASSWORD');
}

function resolveDbProvider() {
  if (config.isTestRun) {
    return 'sqlite';
  }

  if (config.isVercel && hasUsablePostgresConnection()) {
    return 'postgres';
  }

  const requested = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
  if (requested === 'postgres') {
    if (!hasUsablePostgresConnection()) {
      console.warn('DB_PROVIDER=postgres, mas a conexao do Supabase nao esta configurada: usando SQLite local.');
      return 'sqlite';
    }
    return 'postgres';
  }

  return 'sqlite';
}

let provider = resolveDbProvider();
// Intencao configurada, separada do provedor em uso: uma falha passageira de
// rede nao pode aposentar o Postgres para sempre.
const postgresConfigured = provider === 'postgres';
let postgresRetryAfter = 0;
let postgresCheckedAt = 0;
let postgresPool = null;
let sqliteDb = null;

function sqlitePath() {
  if (process.env.SQLITE_PATH) {
    return process.env.SQLITE_PATH;
  }
  return config.isTestRun ? ':memory:' : path.join(config.dataDir, 'pizzaria.db');
}

function getSqlite() {
  if (!sqliteDb) {
    const { DatabaseSync } = require('node:sqlite');
    const file = sqlitePath();
    if (file !== ':memory:') {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
      } catch {
        // Disco somente leitura (serverless): quem abrir o banco recebe o erro.
      }
    }
    sqliteDb = new DatabaseSync(file);
  }
  return sqliteDb;
}

function getPostgresPool() {
  if (!postgresPool) {
    const connectionString = postgresConnectionString();
    if (!connectionString) {
      throw new Error('Configure SUPABASE_DB_URL ou DATABASE_URL antes de usar DB_PROVIDER=postgres.');
    }

    // Postgres local (Docker, testes) roda sem TLS: use ?sslmode=disable na URL.
    const sslDisabled = /[?&]sslmode=disable\b/i.test(connectionString);
    const cleanUrl = connectionString.replace(/([?&])sslmode=disable&?/i, '$1').replace(/[?&]$/, '');
    postgresPool = new Pool({
      connectionString: process.env.DB_SESSION_MODE === '1' ? sessionModeUrl(cleanUrl) : cleanUrl,
      // O Supabase usa certificado proprio; a verificacao pode ser ligada com
      // PGSSL_STRICT=1 quando o CA estiver configurado no ambiente.
      ssl: sslDisabled ? false : { rejectUnauthorized: process.env.PGSSL_STRICT === '1' },
      // Em serverless a concorrencia vem do numero de instancias, nao do
      // tamanho do pool: um limite baixo evita esgotar as conexoes do Supabase.
      max: Number(process.env.PG_POOL_MAX) || (config.isVercel ? 3 : 10),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });

    // Conexao ociosa derrubada do outro lado (pooler do Supabase reciclando,
    // banco reiniciando): o proprio pool descarta aquele cliente. Sem este
    // ouvinte o Node trataria como excecao nao capturada e cairia.
    postgresPool.on('error', (err) => {
      console.warn('[db] Conexao ociosa do Postgres perdida; o pool abre outra quando precisar.', err.message);
      postgresCheckedAt = 0;
    });
  }

  return postgresPool;
}

async function ensurePostgresReady() {
  if (!postgresConfigured) {
    return false;
  }

  if (provider !== 'postgres') {
    // Em fallback local: so tenta de novo depois da janela de espera.
    if (Date.now() < postgresRetryAfter) {
      return false;
    }
    provider = 'postgres';
    postgresCheckedAt = 0;
  }

  if (postgresPool && Date.now() - postgresCheckedAt < POSTGRES_HEALTHCHECK_MS) {
    return true;
  }

  try {
    await getPostgresPool().query('SELECT 1');
    postgresCheckedAt = Date.now();
    return true;
  } catch (error) {
    postgresPool = null;
    postgresCheckedAt = 0;

    // Em serverless o disco e somente leitura e some a cada invocacao: cair
    // para SQLite ali corromperia o comportamento do site. Falha visivel e a
    // proxima requisicao tenta de novo.
    if (config.isProduction) {
      throw new Error(`Banco de dados indisponivel: ${error.message}`);
    }

    console.warn('Postgres indisponivel, usando SQLite local por alguns segundos.', error.message);
    provider = 'sqlite';
    postgresRetryAfter = Date.now() + POSTGRES_RETRY_MS;
    return false;
  }
}

function convertSqlForPostgres(sql, params = []) {
  const hadInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  let normalized = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');

  if (hadInsertOrIgnore && !/ON\s+CONFLICT/i.test(normalized)) {
    normalized = `${normalized} ON CONFLICT DO NOTHING`;
  }

  normalized = normalized.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY');

  if (/^\s*INSERT\s+INTO/i.test(normalized) && !/RETURNING/i.test(normalized)) {
    normalized = `${normalized} RETURNING id`;
  }

  let index = 0;
  const converted = normalized.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  return { sql: converted, params };
}

// node:sqlite nao aceita booleanos e trata undefined de forma diferente do
// driver antigo: normaliza para manter o comportamento.
function normalizeSqliteParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

// Linhas do node:sqlite tem prototipo nulo; converte para objeto comum.
function plain(row) {
  return row ? { ...row } : row;
}

const PRAGMA_TABLE_INFO = /^\s*PRAGMA\s+table_info\s*\(\s*['"]?([A-Za-z0-9_]+)['"]?\s*\)/i;

// Executor ligado a um "queryable" do Postgres (pool ou cliente dedicado).
function createPostgresExecutor(queryable) {
  async function query(sql, params) {
    const tableInfo = sql.match(PRAGMA_TABLE_INFO);
    if (tableInfo) {
      return queryable.query(
        `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [tableInfo[1]]
      );
    }
    const { sql: text, params: values } = convertSqlForPostgres(sql, params);
    return queryable.query(text, values);
  }

  return {
    dialect: 'postgres',
    async run(sql, params = []) {
      const result = await query(sql, params);
      return { id: result.rows?.[0]?.id ?? null, changes: result.rowCount ?? 0 };
    },
    async get(sql, params = []) {
      const result = await query(sql, params);
      return result.rows[0] || null;
    },
    async all(sql, params = []) {
      const result = await query(sql, params);
      return result.rows;
    },
    async exec(sql) {
      await queryable.query(sql);
    },
  };
}

function createSqliteExecutor() {
  return {
    dialect: 'sqlite',
    async run(sql, params = []) {
      const result = getSqlite().prepare(sql).run(...normalizeSqliteParams(params));
      return { id: Number(result.lastInsertRowid) || null, changes: Number(result.changes) };
    },
    async get(sql, params = []) {
      return plain(getSqlite().prepare(sql).get(...normalizeSqliteParams(params)));
    },
    async all(sql, params = []) {
      return getSqlite().prepare(sql).all(...normalizeSqliteParams(params)).map(plain);
    },
    async exec(sql) {
      getSqlite().exec(sql);
    },
  };
}

const sqliteExecutor = createSqliteExecutor();

// Executor do provedor em uso agora (ja considerando o fallback local).
async function currentExecutor() {
  if (provider === 'postgres' && (await ensurePostgresReady())) {
    return createPostgresExecutor(getPostgresPool());
  }
  return sqliteExecutor;
}

async function run(sql, params = []) {
  return (await currentExecutor()).run(sql, params);
}

async function get(sql, params = []) {
  return (await currentExecutor()).get(sql, params);
}

async function all(sql, params = []) {
  return (await currentExecutor()).all(sql, params);
}

// Executa `fn` com um executor exclusivo (uma unica conexao no Postgres),
// usado pelas migracoes para transacao e trava.
async function withExclusiveExecutor(fn) {
  if (provider === 'postgres' && (await ensurePostgresReady())) {
    const client = await getPostgresPool().connect();
    try {
      return await fn(createPostgresExecutor(client));
    } finally {
      client.release();
    }
  }
  return fn(sqliteExecutor);
}

async function prepareProvider() {
  await ensurePostgresReady();
  return provider;
}

function currentProvider() {
  return provider;
}

async function closeConnections() {
  if (postgresPool) {
    const pool = postgresPool;
    postgresPool = null;
    postgresCheckedAt = 0;
    await pool.end();
  }

  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}

module.exports = {
  run,
  get,
  all,
  withExclusiveExecutor,
  prepareProvider,
  currentProvider,
  closeConnections,
  convertSqlForPostgres,
  sessionModeUrl,
};
