// Erros HTTP e tratamento central.
//
// Rotas lancam HttpError (ou qualquer erro com statusCode < 500) para mandar
// uma mensagem ao usuario. Qualquer outro erro vira 500 com uma mensagem
// generica: detalhes de banco/infra ficam so no log do servidor.
const multer = require('multer');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const badRequest = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);
const conflict = (message) => new HttpError(409, message);

// Envolve um handler async e define a mensagem publica usada se ele falhar
// com erro inesperado.
function handle(fallbackMessage, handler) {
  return async function handled(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (!error.publicMessage) {
        error.publicMessage = fallbackMessage;
      }
      next(error);
    }
  };
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que o permitido (5 MB).' : 'Envio de arquivo inválido.';
    return res.status(400).json({ message });
  }

  // Erros do leitor de JSON do Express (corpo malformado ou grande demais).
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corpo da requisição inválido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requisição grande demais.' });
  }

  const status = Number(error.statusCode || error.status) || 500;
  // `expose` marca erros 5xx cuja mensagem e segura e util ao usuario
  // (ex.: JWT_SECRET ausente -> 503).
  if (status >= 500 && !error.expose) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
    return res.status(status).json({ message: error.publicMessage || 'Erro interno do servidor.' });
  }

  return res.status(status).json({ message: error.message });
}

module.exports = {
  HttpError,
  badRequest,
  notFound,
  conflict,
  handle,
  errorHandler,
};
