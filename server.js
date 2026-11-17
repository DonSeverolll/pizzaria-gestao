// Ponto de entrada.
// - Na Vercel (ou quando importado por testes) exporta o app Express.
// - Rodando direto (`npm start` / `npm run dev`) prepara o banco e escuta a porta.
const config = require('./backend/config');
const { createApp } = require('./backend/app');
const { createDb } = require('./backend/db');

const app = createApp();

if (config.isVercel || require.main !== module) {
  module.exports = app;
} else {
  (async () => {
    await createDb();
    app.listen(config.port, () => {
      console.log(`Pizzaria API rodando em http://localhost:${config.port}`);
    });
  })().catch((error) => {
    console.error('Falha ao iniciar o servidor:', error);
    process.exit(1);
  });
}
