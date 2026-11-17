// Cabecalhos de seguranca e limite de requisicoes.
//
// Implementados aqui (sem dependencias extras) para manter o backend enxuto.
// O limitador guarda contagens em memoria: na Vercel cada instancia tem o seu
// contador, o que ja barra forca bruta e spam vindos de um mesmo IP.

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

const MAX_TRACKED_KEYS = 10000;

function rateLimit({ windowMs, max, message, key = (req) => req.ip }) {
  const hits = new Map();

  function prune(now) {
    for (const [entryKey, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(entryKey);
    }
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (hits.size > MAX_TRACKED_KEYS) prune(now);

    const id = String(key(req));
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
}

// Limites usados nas rotas publicas mais sensiveis.
const limiters = {
  // Forca bruta de senha: por IP + usuario tentado.
  login: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
    key: (req) => `${req.ip}|${String(req.body?.username || '').toLowerCase()}`,
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
};

module.exports = {
  CONTENT_SECURITY_POLICY,
  securityHeaders,
  rateLimit,
  limiters,
};
