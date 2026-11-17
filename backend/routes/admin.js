// Rotas de gestao do painel: clientes/CRM, funcionarios, mesas, loja, caixa,
// estoque e relatorios. Cada grupo exige a permissao do perfil (backend/auth.js).
const express = require('express');

const db = require('../db');
const { authMiddleware, requirePermission, requireOwner, isOwner, ROLE_LABELS } = require('../auth');
const { handle, badRequest, notFound, conflict } = require('../http/errors');
const { cleanText, positiveId } = require('../http/validation');

const router = express.Router();

const ASSIGNABLE_ROLES = ['dono', 'gerente', 'caixa', 'cozinha'];
const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'cleaning'];
const MIN_STAFF_PASSWORD = 8;

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

// ---------------------------------------------------------------- Clientes

router.get(
  '/customers',
  authMiddleware,
  requirePermission('clientes'),
  handle('Erro ao buscar clientes.', async (req, res) => {
    res.json(await db.getCustomers());
  })
);

router.get(
  '/crm/customers',
  authMiddleware,
  requirePermission('crm'),
  handle('Erro ao carregar o CRM.', async (req, res) => {
    const customers = await db.getCrmCustomers();
    const totals = customers.reduce(
      (acc, customer) => {
        acc.receita += customer.totalSpent;
        acc.pedidos += customer.orders;
        acc[customer.segment] = (acc[customer.segment] || 0) + 1;
        return acc;
      },
      { receita: 0, pedidos: 0 }
    );

    res.json({
      customers,
      resumo: {
        total: customers.length,
        receita: totals.receita,
        pedidos: totals.pedidos,
        ticketMedio: totals.pedidos ? totals.receita / totals.pedidos : 0,
        novos: totals.novo || 0,
        recorrentes: totals.recorrente || 0,
        inativos: totals.inativo || 0,
      },
    });
  })
);

router.get(
  '/crm/customers/history',
  authMiddleware,
  requirePermission('crm'),
  handle('Erro ao carregar histórico.', async (req, res) => {
    const phone = typeof req.query.phone === 'string' ? req.query.phone : null;
    const name = typeof req.query.name === 'string' ? req.query.name : null;
    if (!phone && !name) {
      throw badRequest('Informe telefone ou nome do cliente.');
    }

    res.json(await db.attachItems(await db.getOrdersByPhoneOrName({ phone, name })));
  })
);

// ----------------------------------------------------------- Funcionarios

router.get(
  '/admin/users',
  authMiddleware,
  requireOwner,
  handle('Erro ao listar funcionários.', async (req, res) => {
    res.json({ users: await db.listUsers(), roles: ROLE_LABELS });
  })
);

router.post(
  '/admin/users',
  authMiddleware,
  requireOwner,
  handle('Erro ao criar funcionário.', async (req, res) => {
    const { password, role } = req.body || {};
    const username = cleanText(req.body?.username, 60);
    const name = cleanText(req.body?.name, 80);

    if (!username || !password || !role) {
      throw badRequest('Usuário, senha e perfil são obrigatórios.');
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw badRequest('Perfil inválido.');
    }
    if (String(password).length < MIN_STAFF_PASSWORD) {
      throw badRequest(`A senha precisa ter pelo menos ${MIN_STAFF_PASSWORD} caracteres.`);
    }
    if ((await db.getUserByUsername(username)) || (await db.getCustomerByLogin(username))) {
      throw conflict('Já existe um funcionário com esse usuário.');
    }

    res.status(201).json(await db.createStaffUser({ username, password: String(password), name, role }));
  })
);

router.patch(
  '/admin/users/:id',
  authMiddleware,
  requireOwner,
  handle('Erro ao atualizar funcionário.', async (req, res) => {
    const id = positiveId(req.params.id);
    const { role, password } = req.body || {};
    const name = req.body?.name === undefined ? undefined : cleanText(req.body.name, 80);

    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      throw badRequest('Perfil inválido.');
    }
    if (password && String(password).length < MIN_STAFF_PASSWORD) {
      throw badRequest(`A senha precisa ter pelo menos ${MIN_STAFF_PASSWORD} caracteres.`);
    }

    const target = id ? await db.getUserById(id) : null;
    if (!target) {
      throw notFound('Funcionário não encontrado.');
    }

    // Rebaixar o ultimo dono deixaria a loja sem quem administra funcionarios.
    if (role && isOwner(target.role) && !isOwner(role) && (await db.countOwners()) <= 1) {
      throw conflict('Este é o último dono: promova outro antes de mudar o perfil dele.');
    }

    res.json(await db.updateStaffUser(id, { name, role, password: password ? String(password) : undefined }));
  })
);

router.delete(
  '/admin/users/:id',
  authMiddleware,
  requireOwner,
  handle('Erro ao remover funcionário.', async (req, res) => {
    const id = positiveId(req.params.id);

    if (id === Number(req.user.id)) {
      throw conflict('Você não pode remover a própria conta.');
    }

    const target = id ? await db.getUserById(id) : null;
    if (!target) {
      throw notFound('Funcionário não encontrado.');
    }

    if (isOwner(target.role) && (await db.countOwners()) <= 1) {
      throw conflict('Não é possível remover o último dono da loja.');
    }

    await db.deleteStaffUser(id);
    res.status(204).end();
  })
);

// ------------------------------------------------------------------ Mesas

router.get(
  '/tables',
  authMiddleware,
  requirePermission('mesas'),
  handle('Erro ao buscar mesas.', async (req, res) => {
    const tables = await db.getTables();
    const summary = { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const table of tables) {
      if (table.status in summary) summary[table.status] += 1;
    }
    res.json({ tables, summary });
  })
);

router.post(
  '/tables',
  authMiddleware,
  requirePermission('mesas'),
  handle('Erro ao cadastrar mesa.', async (req, res) => {
    const name = cleanText(req.body?.name, 60);
    const capacity = Number(req.body?.capacity);

    if (!name || !Number.isInteger(capacity) || capacity <= 0 || capacity > 100) {
      throw badRequest('Nome e capacidade são obrigatórios.');
    }

    const result = await db.createTable({ name, capacity, status: 'available' });
    res.status(201).json({ id: result.id, name, capacity, status: 'available' });
  })
);

router.patch(
  '/tables/:id/status',
  authMiddleware,
  requirePermission('mesas'),
  handle('Erro ao atualizar mesa.', async (req, res) => {
    const id = positiveId(req.params.id);
    const { status } = req.body || {};

    if (!TABLE_STATUSES.includes(status)) {
      throw badRequest('Status inválido.');
    }

    await db.updateTableStatus(id, status);
    const table = (await db.getTables()).find((value) => value.id === id);
    if (!table) {
      throw notFound('Mesa não encontrada.');
    }
    res.json(table);
  })
);

// ------------------------------------------------------------------- Loja

const withIsOpen = (settings) => ({ ...settings, isOpen: settings ? Boolean(Number(settings.is_open)) : true });

router.get(
  '/store/settings',
  authMiddleware,
  requireOwner,
  handle('Erro ao carregar configurações da loja.', async (req, res) => {
    res.json(withIsOpen(await db.getStoreSettings()));
  })
);

router.post(
  '/store/settings',
  authMiddleware,
  requireOwner,
  handle('Erro ao salvar configurações da loja.', async (req, res) => {
    const body = req.body || {};
    if (body.logoUrl && !/^(https:\/\/|\/(?!\/))[^\s"'<>]*$/i.test(String(body.logoUrl))) {
      throw badRequest('Logo inválido: use um endereço https ou um caminho do próprio site.');
    }
    if (body.deliveryFee !== undefined && !(Number(body.deliveryFee) >= 0)) {
      throw badRequest('Taxa de entrega inválida.');
    }
    res.json(withIsOpen(await db.saveStoreSettings(body)));
  })
);

router.get(
  '/store/hours',
  authMiddleware,
  requireOwner,
  handle('Erro ao carregar horários da loja.', async (req, res) => {
    const hours = await db.getStoreHours();
    res.json(hours.map((entry) => ({ ...entry, enabled: Boolean(Number(entry.enabled)) })));
  })
);

router.post(
  '/store/hours',
  authMiddleware,
  requireOwner,
  handle('Erro ao salvar horários da loja.', async (req, res) => {
    const hours = Array.isArray(req.body) ? req.body : req.body?.hours || [];
    const validTime = (value) => value === undefined || value === null || value === '' || /^\d{2}:\d{2}$/.test(String(value));
    const valid = hours.length <= 14 && hours.every((entry) => {
      const day = Number(entry?.dayOfWeek);
      return Number.isInteger(day) && day >= 0 && day <= 6 && validTime(entry.openTime) && validTime(entry.closeTime);
    });
    if (!valid) {
      throw badRequest('Horários inválidos.');
    }
    res.json(await db.saveStoreHours(hours));
  })
);

// ------------------------------------------------------------------ Caixa

router.get(
  '/cash/register',
  authMiddleware,
  requirePermission('caixa'),
  handle('Erro ao carregar caixa.', async (req, res) => {
    const register = await db.getCashRegister();
    res.json(
      register || { status: 'closed', movements: [], initial_balance: 0, cash_total: 0, pix_total: 0, card_total: 0, withdrawals: 0 }
    );
  })
);

router.post(
  '/cash/register/open',
  authMiddleware,
  requirePermission('caixa'),
  handle('Erro ao abrir caixa.', async (req, res) => {
    const initialBalance = Number(req.body?.initialBalance || 0);
    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      throw badRequest('Saldo inicial inválido.');
    }

    const register = await db.openCashRegister({
      initialBalance,
      openedBy: cleanText(req.body?.openedBy, 60) || req.user.username || 'admin',
      notes: cleanText(req.body?.notes, 500) || '',
    });
    res.status(201).json(register);
  })
);

router.post(
  '/cash/register/movement',
  authMiddleware,
  requirePermission('caixa'),
  handle('Erro ao registrar movimento.', async (req, res) => {
    const { registerId, type, amount, method } = req.body || {};
    if (!registerId || !type || !amount) {
      throw badRequest('Registro, tipo e valor são obrigatórios.');
    }
    if (!db.CASH_MOVEMENT_TYPES.includes(type)) {
      throw badRequest('Tipo de movimento inválido.');
    }
    if (!isPositiveNumber(amount)) {
      throw badRequest('Valor inválido.');
    }

    const register = await db.getCashRegisterById(positiveId(registerId));
    if (!register) {
      throw notFound('Caixa não encontrado.');
    }
    if (register.status !== 'open') {
      throw conflict('Este caixa já foi fechado.');
    }

    const movement = await db.addCashMovement({
      registerId: register.id,
      type,
      amount: Number(amount),
      method: ['dinheiro', 'pix', 'cartao'].includes(method) ? method : 'dinheiro',
      description: cleanText(req.body?.description, 200) || '',
    });
    res.status(201).json(movement);
  })
);

router.post(
  '/cash/register/close',
  authMiddleware,
  requirePermission('caixa'),
  handle('Erro ao fechar caixa.', async (req, res) => {
    const registerId = positiveId(req.body?.registerId);
    if (!registerId) {
      throw badRequest('Registro do caixa é obrigatório.');
    }

    res.json(await db.closeCashRegister({ registerId, notes: cleanText(req.body?.notes, 500) || '' }));
  })
);

// ---------------------------------------------------------------- Estoque

router.get(
  '/inventory',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao buscar estoque.', async (req, res) => {
    res.json(await db.getInventory());
  })
);

router.post(
  '/inventory',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao cadastrar ingrediente.', async (req, res) => {
    const ingredientName = cleanText(req.body?.ingredientName, 80);
    const unit = cleanText(req.body?.unit, 20);
    const { quantity, minimumQuantity } = req.body || {};
    if (!ingredientName || !unit) {
      throw badRequest('Nome do ingrediente e unidade são obrigatórios.');
    }
    if ([quantity, minimumQuantity].some((value) => value !== undefined && value !== '' && !(Number(value) >= 0))) {
      throw badRequest('Quantidades inválidas.');
    }

    res.status(201).json(await db.createInventoryItem({ ingredientName, unit, quantity, minimumQuantity }));
  })
);

router.patch(
  '/inventory/:id',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao atualizar ingrediente.', async (req, res) => {
    const body = req.body || {};
    const changes = {
      unit: body.unit === undefined ? undefined : cleanText(body.unit, 20),
      minimumQuantity: body.minimumQuantity,
    };
    if (changes.minimumQuantity !== undefined && !(Number(changes.minimumQuantity) >= 0)) {
      throw badRequest('Quantidade mínima inválida.');
    }

    const id = positiveId(req.params.id);
    const updated = id ? await db.updateInventoryItem(id, changes) : null;
    if (!updated) {
      throw notFound('Ingrediente não encontrado.');
    }
    res.json(updated);
  })
);

router.delete(
  '/inventory/:id',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao excluir ingrediente.', async (req, res) => {
    await db.deleteInventoryItem(positiveId(req.params.id));
    res.status(204).end();
  })
);

router.post(
  '/inventory/:id/movement',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao registrar movimento.', async (req, res) => {
    const { movementType, quantity } = req.body || {};

    if (!db.INVENTORY_MOVEMENT_TYPES.includes(movementType) || !quantity) {
      throw badRequest('Tipo de movimento e quantidade são obrigatórios.');
    }
    if (!isPositiveNumber(quantity)) {
      throw badRequest('Quantidade inválida.');
    }

    const updated = await db.addInventoryMovement({
      id: positiveId(req.params.id),
      movementType,
      quantity: Number(quantity),
      notes: cleanText(req.body?.notes, 200) || '',
    });
    if (!updated) {
      throw notFound('Ingrediente não encontrado.');
    }
    res.status(201).json(updated);
  })
);

router.get(
  '/inventory/:id/movements',
  authMiddleware,
  requirePermission('estoque'),
  handle('Erro ao buscar movimentos.', async (req, res) => {
    const id = positiveId(req.params.id);
    const item = id ? await db.getInventoryItem(id) : null;
    if (!item) {
      throw notFound('Ingrediente não encontrado.');
    }
    res.json(await db.getInventoryMovements(item.ingredient_name));
  })
);

// ------------------------------------------------------------- Relatorios

router.get(
  '/reports/sales',
  authMiddleware,
  requirePermission('lucro'),
  handle('Erro ao gerar relatório.', async (req, res) => {
    const period = ['today', '7d', 'month', 'custom'].includes(req.query.period) ? req.query.period : 'today';
    const dateParam = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
    res.json(await db.getSalesReport({ period, from: dateParam(req.query.from), to: dateParam(req.query.to) }));
  })
);

module.exports = router;
