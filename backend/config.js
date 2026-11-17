// Configuracao central do backend. Carrega o .env com o recurso nativo do
// Node (process.loadEnvFile), sem depender do pacote dotenv. Variaveis que ja
// existem no ambiente (Vercel, terminal, --env-file) tem prioridade.
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const envFile = path.join(rootDir, '.env');

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

// O executor do `node --test` roda cada arquivo num processo filho marcado
// com NODE_TEST_CONTEXT; os testes nunca devem tocar o banco de producao.
const isTestRun =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.execArgv.includes('--test') ||
  process.env.npm_lifecycle_event === 'test';

module.exports = {
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  dataDir: path.join(rootDir, 'data'),
  port: Number(process.env.PORT) || 3000,
  isVercel,
  isProduction,
  isTestRun,
};
