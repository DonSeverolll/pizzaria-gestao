// Login (equipe e clientes), cadastro de cliente e sessao atual.
const express = require('express');
const bcrypt = require('bcryptjs');

const { getUserByUsername, getCustomerByLogin, createCustomer } = require('../db');
const { signToken, authMiddleware, requireAuth, isOwner, ROLE_LABELS, ROLE_PERMISSIONS } = require('../auth');
const { handle, badRequest, conflict, HttpError } = require('../http/errors');
const { limiters } = require('../http/security');
const { cleanText } = require('../http/validation');

const router = express.Router();

// Hash descartavel: comparar contra ele quando o usuario nao existe deixa a
// resposta com o mesmo tempo, sem revelar quais logins estao cadastrados.
const DUMMY_HASH = '$2b$10$T3dAoblelzjireuqJdK.z.bbqWG62cgzPw2ZNjK58.uljm8m8an4i';
const MIN_CUSTOMER_PASSWORD = 8;

const invalidCredentials = () => new HttpError(401, 'Credenciais inválidas.');

router.post(
  '/auth/login',
  limiters.login,
  handle('Erro ao autenticar.', async (req, res) => {
    const username = cleanText(req.body?.username, 80);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      throw badRequest('Usuário e senha são obrigatórios.');
    }

    const staffUser = await getUserByUsername(username);
    if (staffUser) {
      if (!(await bcrypt.compare(password, staffUser.password_hash))) {
        throw invalidCredentials();
      }

      // Perfil desconhecido nao vira dono por padrao.
      const role = staffUser.role;
      if (!ROLE_PERMISSIONS[role]) {
        throw invalidCredentials();
      }

      const token = signToken({ ...staffUser, role, type: 'staff' });
      return res.json({
        token,
        user: {
          id: staffUser.id,
          username: staffUser.username,
          name: staffUser.name || staffUser.username,
          role,
          roleLabel: ROLE_LABELS[role] || role,
          permissions: ROLE_PERMISSIONS[role],
          type: 'staff',
        },
      });
    }

    const customer = await getCustomerByLogin(username);
    const passwordMatches = await bcrypt.compare(password, customer?.password_hash || DUMMY_HASH);
    if (!customer || !passwordMatches) {
      throw invalidCredentials();
    }

    const token = signToken({ ...customer, role: 'customer', type: 'customer', username: customer.login });
    return res.json({
      token,
      user: {
        id: customer.id,
        username: customer.login,
        name: customer.name,
        role: 'customer',
        type: 'customer',
      },
    });
  })
);

router.post(
  '/customers/register',
  limiters.register,
  handle('Erro ao registrar cliente.', async (req, res) => {
    const name = cleanText(req.body?.name, 80);
    const login = cleanText(req.body?.login, 60);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name || !login || !password) {
      throw badRequest('Nome, login e senha são obrigatórios.');
    }

    if (password.length < MIN_CUSTOMER_PASSWORD) {
      throw badRequest(`A senha precisa ter pelo menos ${MIN_CUSTOMER_PASSWORD} caracteres.`);
    }

    if ((await getCustomerByLogin(login)) || (await getUserByUsername(login))) {
      throw conflict('Este login já foi cadastrado.');
    }

    const customer = await createCustomer({ name, login, password, paymentKey: cleanText(req.body?.paymentKey, 60) });
    res.status(201).json({ customer });
  })
);

router.get('/auth/me', authMiddleware, requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      roleLabel: ROLE_LABELS[req.user.role] || req.user.role,
      permissions: ROLE_PERMISSIONS[req.user.role] || [],
      isOwner: isOwner(req.user.role),
    },
  });
});

module.exports = router;
