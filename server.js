const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const {
  createDb,
  getUserByUsername,
  getCustomerByLogin,
  createCustomer,
  getCustomers,
  createProduct,
  updateProduct,
  deleteProduct,
  getMenuItems,
  getAllMenuItems,
  getTables,
  createOrder,
  getOrders,
  updateOrderStatus,
  getOrderItemsByOrder,
  getOrdersByCustomer,
  updateTableStatus,
  createTable,
  getStoreSettings,
  saveStoreSettings,
  getStoreHours,
  saveStoreHours,
  getCashRegister,
  openCashRegister,
  addCashMovement,
  closeCashRegister,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryMovement,
  getInventoryMovements,
  getSalesReport,
} = require('./backend/db');
const { signToken, authMiddleware, requireAdmin, requireAuth } = require('./backend/auth');
const { uploadImage } = require('./backend/storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pizzaria-api' });
});

app.get('/api/menu', async (req, res) => {
  try {
    const category = req.query.category || null;
    const items = await getMenuItems(category);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar o cardápio.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    const adminUser = await getUserByUsername(username);
    if (adminUser) {
      const passwordMatches = await bcrypt.compare(password, adminUser.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      const token = signToken({ ...adminUser, role: 'admin', type: 'admin' });
      return res.json({
        token,
        user: {
          id: adminUser.id,
          username: adminUser.username,
          role: 'admin',
          type: 'admin',
        },
      });
    }

    const customer = await getCustomerByLogin(username);
    if (!customer) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(password, customer.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
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
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar.', error: error.message });
  }
});

app.post('/api/customers/register', async (req, res) => {
  try {
    const { name, login, password, paymentKey } = req.body;

    if (!name || !login || !password) {
      return res.status(400).json({ message: 'Nome, login e senha são obrigatórios.' });
    }

    const existingCustomer = await getCustomerByLogin(login);
    if (existingCustomer) {
      return res.status(409).json({ message: 'Este login já foi cadastrado.' });
    }

    const customer = await createCustomer({ name, login, password, paymentKey });
    return res.status(201).json({ customer });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar cliente.', error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

app.get('/api/customers', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const customers = await getCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar clientes.', error: error.message });
  }
});

app.get('/api/orders', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orders = await getOrders();
    const response = [];

    for (const order of orders) {
      response.push({
        ...order,
        items: await getOrderItemsByOrder(order.id),
      });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar pedidos.', error: error.message });
  }
});

app.patch('/api/orders/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['em-preparo', 'pronto', 'em-entrega', 'entregue'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status inválido.' });
    }

    await updateOrderStatus(Number(req.params.id), status);
    const orders = await getOrders();
    const order = orders.find((item) => item.id === Number(req.params.id));

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar status.', error: error.message });
  }
});

app.get('/api/me/orders', authMiddleware, requireAuth, async (req, res) => {
  try {
    const customer = await getCustomerByLogin(req.user.username);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const orders = await getOrdersByCustomer(customer.id);
    const response = [];

    for (const order of orders) {
      response.push({
        ...order,
        items: await getOrderItemsByOrder(order.id),
      });
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar histórico do cliente.', error: error.message });
  }
});

app.post('/api/products', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const product = req.body;
    if (!product?.name || !product?.category || !product?.price) {
      return res.status(400).json({ message: 'Nome, categoria e valor do produto são obrigatórios.' });
    }

    const result = await createProduct(product);
    return res.status(201).json({ id: result.id, ...product });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar produto.', error: error.message });
  }
});

app.get('/api/products', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const products = await getAllMenuItems();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar produtos.', error: error.message });
  }
});

app.patch('/api/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await updateProduct(Number(req.params.id), req.body || {});
    if (!updated) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar produto.', error: error.message });
  }
});

app.delete('/api/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await deleteProduct(Number(req.params.id));
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir produto.', error: error.message });
  }
});

app.post('/api/uploads/image', authMiddleware, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const url = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro ao enviar imagem.' });
  }
});

app.get('/api/tables', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const tables = await getTables();
    const summary = tables.reduce(
      (acc, table) => {
        if (table.status === 'available') acc.available += 1;
        if (table.status === 'occupied') acc.occupied += 1;
        if (table.status === 'reserved') acc.reserved += 1;
        if (table.status === 'cleaning') acc.cleaning += 1;
        return acc;
      },
      { available: 0, occupied: 0, reserved: 0, cleaning: 0 }
    );

    res.json({ tables, summary });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar mesas.', error: error.message });
  }
});

app.post('/api/tables', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, capacity } = req.body;

    if (!name || !capacity || Number(capacity) <= 0) {
      return res.status(400).json({ message: 'Nome e capacidade são obrigatórios.' });
    }

    const result = await createTable({ name, capacity: Number(capacity), status: 'available' });
    return res.status(201).json({ id: result.id, name, capacity: Number(capacity), status: 'available' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar mesa.', error: error.message });
  }
});

app.patch('/api/tables/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['available', 'occupied', 'reserved', 'cleaning'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Status inválido.' });
    }

    await updateTableStatus(Number(id), status);
    const tables = await getTables();
    const table = tables.find((value) => value.id === Number(id));

    if (!table) {
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    return res.json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar mesa.', error: error.message });
  }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { items, customerName, customerLogin, deliveryLocation, paymentMethod } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: 'Pedido vazio.' });
    }

    const totalValue = items.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.price || 0), 0);
    const customer = req.user?.role === 'customer' ? await getCustomerByLogin(req.user.username) : null;
    const order = await createOrder({
      customerId: customer?.id || null,
      customerName: customerName || customer?.name || 'Cliente',
      customerLogin: customerLogin || customer?.login || req.user?.username || null,
      deliveryLocation: deliveryLocation || 'Entrega em domicílio',
      paymentMethod: paymentMethod || 'pix',
      items,
      totalValue,
    });

    return res.status(201).json({ order });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar pedido.', error: error.message });
  }
});

app.get('/api/store/settings', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const settings = await getStoreSettings();
    res.json({
      ...settings,
      isOpen: settings ? Boolean(Number(settings.is_open)) : true,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar configurações da loja.', error: error.message });
  }
});

app.post('/api/store/settings', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const settings = await saveStoreSettings(req.body || {});
    res.json({
      ...settings,
      isOpen: settings ? Boolean(Number(settings.is_open)) : true,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao salvar configurações da loja.', error: error.message });
  }
});

app.get('/api/store/hours', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const hours = await getStoreHours();
    res.json(hours.map((entry) => ({
      ...entry,
      enabled: Boolean(Number(entry.enabled)),
    })));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar horários da loja.', error: error.message });
  }
});

app.post('/api/store/hours', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const hours = Array.isArray(req.body) ? req.body : req.body?.hours || [];
    const saved = await saveStoreHours(hours);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao salvar horários da loja.', error: error.message });
  }
});

app.get('/api/cash/register', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const register = await getCashRegister();
    res.json(register || { status: 'closed', movements: [], initial_balance: 0, cash_total: 0, pix_total: 0, card_total: 0, withdrawals: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar caixa.', error: error.message });
  }
});

app.post('/api/cash/register/open', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const register = await openCashRegister({
      initialBalance: req.body?.initialBalance || 0,
      openedBy: req.body?.openedBy || 'admin',
      notes: req.body?.notes || '',
    });
    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao abrir caixa.', error: error.message });
  }
});

app.post('/api/cash/register/movement', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { registerId, type, amount, method, description } = req.body;
    if (!registerId || !type || !amount) {
      return res.status(400).json({ message: 'Registro, tipo e valor são obrigatórios.' });
    }

    const movement = await addCashMovement({ registerId, type, amount, method, description });
    return res.status(201).json(movement);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar movimento.', error: error.message });
  }
});

app.post('/api/cash/register/close', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { registerId, notes } = req.body;
    if (!registerId) {
      return res.status(400).json({ message: 'Registro do caixa é obrigatório.' });
    }

    const result = await closeCashRegister({ registerId, notes: notes || '' });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao fechar caixa.', error: error.message });
  }
});

app.get('/api/inventory', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const items = await getInventory();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar estoque.', error: error.message });
  }
});

app.post('/api/inventory', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { ingredientName, unit, quantity, minimumQuantity } = req.body;
    if (!ingredientName || !unit) {
      return res.status(400).json({ message: 'Nome do ingrediente e unidade são obrigatórios.' });
    }

    const item = await createInventoryItem({ ingredientName, unit, quantity, minimumQuantity });
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar ingrediente.', error: error.message });
  }
});

app.patch('/api/inventory/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await updateInventoryItem(Number(req.params.id), req.body || {});
    if (!updated) {
      return res.status(404).json({ message: 'Ingrediente não encontrado.' });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar ingrediente.', error: error.message });
  }
});

app.delete('/api/inventory/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await deleteInventoryItem(Number(req.params.id));
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir ingrediente.', error: error.message });
  }
});

app.post('/api/inventory/:id/movement', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { movementType, quantity, notes } = req.body;
    const allowed = ['entrada', 'saida', 'ajuste', 'perda'];

    if (!allowed.includes(movementType) || !quantity) {
      return res.status(400).json({ message: 'Tipo de movimento e quantidade são obrigatórios.' });
    }

    const updated = await addInventoryMovement({ id: Number(req.params.id), movementType, quantity, notes });
    if (!updated) {
      return res.status(404).json({ message: 'Ingrediente não encontrado.' });
    }
    return res.status(201).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar movimento.', error: error.message });
  }
});

app.get('/api/inventory/:id/movements', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const item = (await getInventory()).find((entry) => entry.id === Number(req.params.id));
    if (!item) {
      return res.status(404).json({ message: 'Ingrediente não encontrado.' });
    }

    const movements = await getInventoryMovements(item.ingredient_name);
    return res.json(movements);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar movimentos.', error: error.message });
  }
});

app.get('/api/reports/sales', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const report = await getSalesReport({ period: period || 'today', from, to });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório.', error: error.message });
  }
});

app.get('*', (req, res) => {
  const requestedPath = req.path;
  const knownAdminPages = [
    '/admin',
    '/admin.html',
    '/admin-mesas.html',
    '/admin-clientes.html',
    '/admin-produtos.html',
    '/admin-pedidos.html',
    '/admin-estoque.html',
    '/admin-lucro.html',
    '/admin-config.html',
  ];

  if (knownAdminPages.includes(requestedPath)) {
    const adminFile = requestedPath === '/admin' ? '/admin.html' : requestedPath;
    return res.sendFile(path.join(__dirname, 'public', adminFile));
  }

  return res.sendFile(path.join(__dirname, 'public', '/index.html'));
});

if (process.env.VERCEL || require.main !== module) {
  module.exports = app;
} else {
  (async () => {
    await createDb();
    app.listen(PORT, () => {
      console.log(`Pizzaria API rodando em http://localhost:${PORT}`);
    });
  })();
}
