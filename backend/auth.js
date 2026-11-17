const jwt = require('jsonwebtoken');

const config = require('./config');

const JWT_ALGORITHM = 'HS256';
const TOKEN_TTL = '8h';
const DEV_FALLBACK_SECRET = 'pizzaria-dev-secret';

const MISSING_SECRET_MESSAGE =
  'JWT_SECRET nao configurado no ambiente. Cadastre a variavel antes de usar o painel.';

// O segredo de reserva esta num repositorio publico: aceita-lo fora de
// desenvolvimento deixaria qualquer pessoa forjar um token de dono. Por isso
// so vale com NODE_ENV=development ou nos testes. Sem segredo, a loja
// continua vendendo; apenas o login do painel fica bloqueado, com log claro.
const allowsDevSecret = config.isTestRun || process.env.NODE_ENV === 'development';
const secretMissing = !process.env.JWT_SECRET && !allowsDevSecret;
const JWT_SECRET = process.env.JWT_SECRET || (allowsDevSecret ? DEV_FALLBACK_SECRET : null);

if (secretMissing) {
  console.error(`[SEGURANCA] ${MISSING_SECRET_MESSAGE} O login do painel ficara indisponivel.`);
} else if (config.isProduction && JWT_SECRET.length < 32) {
  console.warn('[SEGURANCA] JWT_SECRET curto: use pelo menos 32 caracteres aleatorios em producao.');
}

function requireSecret() {
  if (secretMissing) {
    const error = new Error(MISSING_SECRET_MESSAGE);
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
}

function signToken(user) {
  requireSecret();

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || 'customer',
      type: user.type || 'user',
    },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: TOKEN_TTL }
  );
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

// Areas do painel que cada perfil enxerga. "admin" e o papel legado dos
// usuarios criados antes dos perfis existirem e equivale a dono.
const ROLE_PERMISSIONS = {
  dono: ['*'],
  admin: ['*'],
  gerente: ['pedidos', 'pagamentos', 'pdv', 'produtos', 'estoque', 'lucro', 'crm', 'clientes', 'mesas', 'caixa'],
  caixa: ['pedidos', 'pagamentos', 'pdv', 'caixa', 'clientes', 'crm', 'mesas'],
  cozinha: ['pedidos'],
};

const ROLE_LABELS = {
  dono: 'Dono',
  admin: 'Dono',
  gerente: 'Gerente',
  caixa: 'Caixa / Atendente',
  cozinha: 'Cozinha',
};

// O perfil de funcionario vem do banco a cada requisicao, nao do token: quem
// foi removido ou rebaixado perde o acesso na hora, sem esperar o token expirar.
async function resolveStaffUser(decoded) {
  const { getUserById } = require('./db');
  const user = await getUserById(Number(decoded.id));
  if (!user || !ROLE_PERMISSIONS[user.role]) {
    return null;
  }
  return { id: user.id, username: user.username, name: user.name, role: user.role, type: 'staff' };
}

async function resolveUser(token) {
  const decoded = verifyToken(token);
  if (decoded.type === 'staff') {
    return resolveStaffUser(decoded);
  }
  return decoded;
}

async function authMiddleware(req, res, next) {
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação ausente.' });
  }

  if (secretMissing) {
    return res.status(503).json({ message: MISSING_SECRET_MESSAGE });
  }

  let user;
  try {
    user = await resolveUser(token);
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }

  if (!user) {
    return res.status(401).json({ message: 'Sessão encerrada: faça login novamente.' });
  }

  req.user = user;
  return next();
}

// Pedido de visitante e o caso normal de uma pizzaria: quem nao esta logado
// segue como convidado em vez de tomar 401.
async function optionalAuth(req, res, next) {
  const token = readBearerToken(req);
  req.user = null;

  if (!token || secretMissing) {
    return next();
  }

  try {
    req.user = (await resolveUser(token)) || null;
  } catch {
    req.user = null;
  }

  return next();
}

function isOwner(role) {
  return role === 'dono' || role === 'admin';
}

function hasPermission(role, area) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(area);
}

// Qualquer funcionario autenticado (nao cliente).
function requireStaff(req, res, next) {
  if (!req.user || !ROLE_PERMISSIONS[req.user.role]) {
    return res.status(403).json({ message: 'Acesso restrito à equipe da pizzaria.' });
  }

  return next();
}

function requirePermission(area) {
  return function permissionMiddleware(req, res, next) {
    if (!req.user || !hasPermission(req.user.role, area)) {
      return res.status(403).json({ message: 'Seu perfil não tem acesso a esta área.' });
    }

    return next();
  };
}

// Reservado ao dono: funcionarios e configuracoes da loja.
function requireOwner(req, res, next) {
  if (!req.user || !isOwner(req.user.role)) {
    return res.status(403).json({ message: 'Apenas o dono pode executar esta ação.' });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !ROLE_PERMISSIONS[req.user.role]) {
    return res.status(403).json({ message: 'Acesso restrito à administração.' });
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  return next();
}

module.exports = {
  signToken,
  authMiddleware,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireStaff,
  requireOwner,
  requirePermission,
  hasPermission,
  isOwner,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
};
