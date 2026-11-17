// Monta o app Express: seguranca, API e arquivos do site.
//
// Para criar uma nova area da API, crie um arquivo em backend/routes/ e
// registre-o abaixo com app.use('/api', ...).
const path = require('node:path');
const express = require('express');

const config = require('./config');
const { securityHeaders, limiters } = require('./http/security');
const { errorHandler } = require('./http/errors');

// Paginas do painel servidas tambem sem a extensao .html.
const ADMIN_PAGES = [
  'admin',
  'admin-mesas',
  'admin-produtos',
  'admin-pedidos',
  'admin-estoque',
  'admin-lucro',
  'admin-config',
  'admin-crm',
  'admin-pdv',
  'admin-funcionarios',
];

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Atras do proxy da Vercel: req.ip e req.protocol passam a refletir o
  // cliente real (necessario para o limite de requisicoes e para HTTPS).
  if (config.isVercel || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  // Express 5 deixa req.body indefinido quando nao ha corpo; as rotas
  // esperam um objeto.
  app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  app.use('/api', require('./routes/public'));
  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/orders'));
  app.use('/api', require('./routes/payments'));
  app.use('/api', require('./routes/catalog'));
  app.use('/api', require('./routes/admin'));

  // Rota de API inexistente responde JSON, nunca o HTML do site.
  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Rota não encontrada.' });
  });

  app.use(express.static(config.publicDir, { index: 'index.html', extensions: ['html'] }));

  app.get('/{*caminho}', limiters.pages, (req, res) => {
    const page = req.path.replace(/^\/+/, '').replace(/\.html$/, '');
    const file = ADMIN_PAGES.includes(page) ? `${page}.html` : 'index.html';
    res.sendFile(path.join(config.publicDir, file));
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp, ADMIN_PAGES };
