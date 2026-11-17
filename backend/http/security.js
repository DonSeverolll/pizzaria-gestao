// Cabecalhos de seguranca e limite de requisicoes.
//
// O limite usa express-rate-limit (reconhecido pelo CodeQL) com contagem em
// memoria: na Vercel cada instancia tem o seu contador, o que ja barra forca
// bruta e spam vindos de um mesmo IP.
const { rateLimit: createRateLimit, ipKeyGenerator } = require('express-rate-limit');

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Atributos style="" no HTML e a folha do Google Fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  // Fotos de produto podem vir do Supabase Storage (https) e o QR Code e data:.
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// Cria um limitador que responde 429 em JSON, no mesmo formato de erro da API.
function rateLimit({ windowMs, max, message, key }) {
  return createRateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    message: { message },
    ...(key ? { keyGenerator: key } : {}),
  });
}

// Limites usados nas rotas publicas mais sensiveis.
const limiters = {
  // Forca bruta de senha: por IP + usuario tentado.
  login: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
    key: (req) => `${ipKeyGenerator(req.ip || '')}|${String(req.body?.username || '').toLowerCase().slice(0, 80)}`,
  }),
  register: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Muitos cadastros a partir desta conexão. Tente mais tarde.',
  }),
  orders: rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: 'Muitos pedidos em sequência. Aguarde um pouco antes de tentar de novo.',
  }),
  tracking: rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Muitas consultas de pedido. Aguarde um minuto.',
  }),
  // Paginas do site servidas do disco: limite folgado, so contra abuso.
  pages: rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Muitas requisições em sequência. Aguarde um minuto.',
  }),
};

module.exports = {
  CONTENT_SECURITY_POLICY,
  securityHeaders,
  rateLimit,
  limiters,
};
