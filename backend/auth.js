const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// O fallback de desenvolvimento e publico (o repositorio e aberto), entao em
// producao ele nao pode ser aceito: com ele qualquer pessoa forjaria um token
// de admin. Falha no boot e melhor do que subir um painel destrancado.
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET nao configurado. Cadastre a variavel de ambiente antes de subir em producao.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET || 'pizzaria-dev-secret';

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || 'customer',
      type: user.type || 'user',
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação ausente.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

// Pedido de visitante e o caso normal de uma pizzaria: quem nao esta logado
// segue como convidado em vez de tomar 401.
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    req.user = null;
  }

  return next();
}

// Areas do painel que cada perfil enxerga. "admin" e o papel legado dos
// usuarios criados antes dos perfis existirem e equivale a dono.
const ROLE_PERMISSIONS = {
  dono: ['*'],
  admin: ['*'],
  gerente: ['pedidos', 'pdv', 'produtos', 'estoque', 'lucro', 'crm', 'clientes', 'mesas', 'caixa'],
  caixa: ['pedidos', 'pdv', 'caixa', 'clientes', 'crm', 'mesas'],
  cozinha: ['pedidos'],
};

const ROLE_LABELS = {
  dono: 'Dono',
  admin: 'Dono',
  gerente: 'Gerente',
  caixa: 'Caixa / Atendente',
  cozinha: 'Cozinha',
};

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
