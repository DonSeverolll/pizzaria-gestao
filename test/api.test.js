// Testes de ponta a ponta da API: sobem o app numa porta livre, com um banco
// SQLite temporario, e exercitam as rotas como o navegador faria.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pizzaria-api-'));
process.env.SQLITE_PATH = path.join(tmpDir, 'test.db');
process.env.NODE_ENV = 'test';

const app = require('../server');
const { closeDb } = require('../backend/db');

let server;
let baseUrl;
let ownerToken;

async function api(method, url, { token, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Resposta nao-JSON (HTML do SPA, por exemplo).
  }
  return { status: response.status, data, headers: response.headers };
}

async function login(username, password) {
  const { status, data } = await api('POST', '/api/auth/login', { body: { username, password } });
  assert.equal(status, 200, `login de ${username} deveria funcionar`);
  return data.token;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  ownerToken = await login('admin', 'admin123');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('health e cardapio publico', async () => {
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');

  const menu = await api('GET', '/api/menu');
  assert.equal(menu.status, 200);
  assert.ok(Array.isArray(menu.data) && menu.data.length >= 10);
  assert.ok(menu.data.every((item) => Number(item.active) === 1));

  const bebidas = await api('GET', '/api/menu?category=Bebidas');
  assert.ok(bebidas.data.length > 0 && bebidas.data.every((item) => item.category === 'Bebidas'));

  const extras = await api('GET', '/api/extras');
  assert.equal(extras.status, 200);
  assert.ok(extras.data.length > 0);
});

test('dados publicos da loja nao expoem a chave Pix', async () => {
  const { status, data } = await api('GET', '/api/store/public-settings');
  assert.equal(status, 200);
  assert.equal(data.companyName, 'PL Pizza');
  assert.equal(data.pixKey, undefined);
  assert.equal(data.pix_key, undefined);
});

test('login: validacao, credencial errada e perfil do dono', async () => {
  assert.equal((await api('POST', '/api/auth/login', { body: {} })).status, 400);
  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'errada' } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'ninguem', password: 'x' } })).status, 401);

  const me = await api('GET', '/api/auth/me', { token: ownerToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, 'admin');
  assert.equal(me.data.user.isOwner, true);
});

test('rotas protegidas exigem token e perfil', async () => {
  assert.equal((await api('GET', '/api/orders')).status, 401);
  assert.equal((await api('GET', '/api/orders', { token: 'token-invalido' })).status, 401);

  const customerToken = await login('cliente', 'cliente123');
  assert.equal((await api('GET', '/api/orders', { token: customerToken })).status, 403);
  assert.equal((await api('GET', '/api/admin/users', { token: customerToken })).status, 403);
});

test('cadastro de cliente, pedido logado e historico', async () => {
  const register = await api('POST', '/api/customers/register', {
    body: { name: 'Maria Teste', login: 'maria', password: 'senha-segura' },
  });
  assert.equal(register.status, 201);
  assert.equal(register.data.customer.password_hash, undefined, 'hash da senha nao deve vazar');

  const duplicate = await api('POST', '/api/customers/register', {
    body: { name: 'Maria', login: 'maria', password: 'senha-segura' },
  });
  assert.equal(duplicate.status, 409);

  const token = await login('maria', 'senha-segura');
  const menu = (await api('GET', '/api/menu')).data;
  const order = await api('POST', '/api/orders', {
    token,
    body: { items: [{ productId: menu[0].id, quantity: 1 }], orderMode: 'retirada', paymentMethod: 'dinheiro' },
  });
  assert.equal(order.status, 201);

  const history = await api('GET', '/api/me/orders', { token });
  assert.equal(history.status, 200);
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].order_code, order.data.order.order_code);
});

test('pedido de visitante: preco calculado no servidor e acompanhamento por codigo', async () => {
  const menu = (await api('GET', '/api/menu')).data;
  const pizza = menu.find((item) => item.name === 'Calabresa');

  const empty = await api('POST', '/api/orders', { body: { items: [] } });
  assert.equal(empty.status, 400);

  const unknown = await api('POST', '/api/orders', { body: { items: [{ productId: 999999 }] } });
  assert.equal(unknown.status, 400);

  const created = await api('POST', '/api/orders', {
    body: {
      customerName: 'Visitante',
      customerPhone: '81999990000',
      orderMode: 'retirada',
      items: [{ productId: pizza.id, quantity: 2, price: 0.01 }],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.resumo.total, Number(pizza.price) * 2, 'preco enviado pelo navegador deve ser ignorado');
  assert.match(created.data.order.order_code, /^PL-[A-Z0-9]{4,6}$/);

  const tracked = await api('GET', `/api/orders/code/${created.data.order.order_code.toLowerCase()}`);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.data.total, Number(pizza.price) * 2);
  assert.equal(tracked.data.items[0].quantity, 2);

  assert.equal((await api('GET', '/api/orders/code/PL-ZZZZ')).status, 404);

  const status = await api('PATCH', `/api/orders/${created.data.order.id}/status`, {
    token: ownerToken,
    body: { status: 'pronto' },
  });
  assert.equal(status.status, 200);
  assert.equal(status.data.status, 'pronto');

  const invalid = await api('PATCH', `/api/orders/${created.data.order.id}/status`, {
    token: ownerToken,
    body: { status: 'inventado' },
  });
  assert.equal(invalid.status, 400);

  const all = await api('GET', '/api/orders', { token: ownerToken });
  assert.ok(all.data.some((order) => order.id === created.data.order.id && order.items.length === 1));
});

test('pagamento Pix gera payload com o total do servidor', async () => {
  const menu = (await api('GET', '/api/menu')).data;
  const { status, data } = await api('POST', '/api/payments/pix', {
    body: { orderMode: 'retirada', items: [{ productId: menu[0].id, quantity: 1 }] },
  });
  assert.equal(status, 201);
  assert.equal(data.order.status, 'aguardando-pagamento');
  assert.match(data.pixPayload, /^000201/);
  assert.match(data.qrCodeDataUrl, /^data:image\/png;base64,/);
});

test('loja fechada recusa pedidos', async () => {
  const current = (await api('GET', '/api/store/settings', { token: ownerToken })).data;
  const menu = (await api('GET', '/api/menu')).data;

  const closed = await api('POST', '/api/store/settings', {
    token: ownerToken,
    body: { companyName: current.company_name, pixKey: current.pix_key, isOpen: false, deliveryFee: current.delivery_fee },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.isOpen, false);

  const refused = await api('POST', '/api/orders', { body: { items: [{ productId: menu[0].id }] } });
  assert.equal(refused.status, 409);

  const reopened = await api('POST', '/api/store/settings', {
    token: ownerToken,
    body: { companyName: current.company_name, pixKey: current.pix_key, isOpen: true, deliveryFee: current.delivery_fee },
  });
  assert.equal(reopened.data.isOpen, true);
});

test('produtos e adicionais: criar, editar, listar e excluir', async () => {
  const missing = await api('POST', '/api/products', { token: ownerToken, body: { name: 'Sem preco' } });
  assert.equal(missing.status, 400);

  const created = await api('POST', '/api/products', {
    token: ownerToken,
    body: { name: 'Pizza Teste', category: 'Pizzas Salgadas e Doces', price: 41.5, description: 'teste' },
  });
  assert.equal(created.status, 201);
  const id = created.data.id;

  const updated = await api('PATCH', `/api/products/${id}`, { token: ownerToken, body: { price: 44, active: false } });
  assert.equal(updated.status, 200);
  assert.equal(Number(updated.data.price), 44);
  assert.equal(Number(updated.data.active), 0);

  const publicMenu = (await api('GET', '/api/menu')).data;
  assert.ok(!publicMenu.some((item) => item.id === id), 'produto inativo nao aparece no cardapio');

  const adminList = (await api('GET', '/api/products', { token: ownerToken })).data;
  assert.ok(adminList.some((item) => item.id === id));

  assert.equal((await api('PATCH', '/api/products/999999', { token: ownerToken, body: { price: 1 } })).status, 404);
  assert.equal((await api('DELETE', `/api/products/${id}`, { token: ownerToken })).status, 204);

  const extra = await api('POST', '/api/admin/extras', { token: ownerToken, body: { name: 'Borda teste', price: 5, category: 'Pizza' } });
  assert.equal(extra.status, 201);
  const extraUpdated = await api('PATCH', `/api/admin/extras/${extra.data.id}`, { token: ownerToken, body: { price: 6 } });
  assert.equal(Number(extraUpdated.data.price), 6);
  assert.equal((await api('DELETE', `/api/admin/extras/${extra.data.id}`, { token: ownerToken })).status, 204);
});

test('PDV, caixa e relatorio de vendas', async () => {
  const opened = await api('POST', '/api/cash/register/open', { token: ownerToken, body: { initialBalance: 100 } });
  assert.equal(opened.status, 201);
  assert.equal(opened.data.status, 'open');

  const menu = (await api('GET', '/api/menu')).data;
  const sale = await api('POST', '/api/pdv/sale', {
    token: ownerToken,
    body: { items: [{ productId: menu[0].id, quantity: 1 }], paymentMethod: 'dinheiro' },
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.data.lancadoNoCaixa, true);

  const withdrawal = await api('POST', '/api/cash/register/movement', {
    token: ownerToken,
    body: { registerId: opened.data.id, type: 'saida', amount: 10, description: 'troco' },
  });
  assert.equal(withdrawal.status, 201);

  const register = (await api('GET', '/api/cash/register', { token: ownerToken })).data;
  assert.equal(Number(register.cash_total), Number(menu[0].price));
  assert.equal(Number(register.withdrawals), 10);
  assert.ok(register.movements.length >= 2);

  const closed = await api('POST', '/api/cash/register/close', { token: ownerToken, body: { registerId: opened.data.id } });
  assert.equal(closed.data.status, 'closed');

  const report = await api('GET', '/api/reports/sales?period=today', { token: ownerToken });
  assert.equal(report.status, 200);
  assert.ok(report.data.totalOrders >= 1);
  assert.ok(Array.isArray(report.data.products));
});

test('mesas, estoque e CRM', async () => {
  const table = await api('POST', '/api/tables', { token: ownerToken, body: { name: 'Mesa 99', capacity: 4 } });
  assert.equal(table.status, 201);
  const occupied = await api('PATCH', `/api/tables/${table.data.id}/status`, { token: ownerToken, body: { status: 'occupied' } });
  assert.equal(occupied.data.status, 'occupied');
  const tables = (await api('GET', '/api/tables', { token: ownerToken })).data;
  assert.ok(tables.summary.occupied >= 1);

  const ingredient = await api('POST', '/api/inventory', {
    token: ownerToken,
    body: { ingredientName: 'Oregano', unit: 'kg', quantity: 2, minimumQuantity: 1 },
  });
  assert.equal(ingredient.status, 201);
  const moved = await api('POST', `/api/inventory/${ingredient.data.id}/movement`, {
    token: ownerToken,
    body: { movementType: 'saida', quantity: 0.5 },
  });
  assert.equal(Number(moved.data.quantity), 1.5);
  const movements = (await api('GET', `/api/inventory/${ingredient.data.id}/movements`, { token: ownerToken })).data;
  assert.equal(movements.length, 1);
  assert.equal((await api('DELETE', `/api/inventory/${ingredient.data.id}`, { token: ownerToken })).status, 204);

  const crm = await api('GET', '/api/crm/customers', { token: ownerToken });
  assert.equal(crm.status, 200);
  assert.ok(crm.data.resumo.total >= 1);
  const history = await api('GET', '/api/crm/customers/history?phone=81999990000', { token: ownerToken });
  assert.equal(history.status, 200);
  assert.ok(history.data.length >= 1);
});

test('funcionarios: perfis validos e protecao do ultimo dono', async () => {
  const invalid = await api('POST', '/api/admin/users', {
    token: ownerToken,
    body: { username: 'x', password: '123456', role: 'superadmin' },
  });
  assert.equal(invalid.status, 400);

  const created = await api('POST', '/api/admin/users', {
    token: ownerToken,
    body: { username: 'cozinheiro', password: 'senha123', name: 'Chef', role: 'cozinha' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.password_hash, undefined);

  const kitchenToken = await login('cozinheiro', 'senha123');
  assert.equal((await api('GET', '/api/orders', { token: kitchenToken })).status, 200);
  assert.equal((await api('GET', '/api/inventory', { token: kitchenToken })).status, 403);

  const users = (await api('GET', '/api/admin/users', { token: ownerToken })).data.users;
  const owner = users.find((user) => user.username === 'admin');
  const demote = await api('PATCH', `/api/admin/users/${owner.id}`, { token: ownerToken, body: { role: 'caixa' } });
  assert.equal(demote.status, 409);
  assert.equal((await api('DELETE', `/api/admin/users/${owner.id}`, { token: ownerToken })).status, 409);
  assert.equal((await api('DELETE', `/api/admin/users/${created.data.id}`, { token: ownerToken })).status, 204);
});

test('paginas: SPA e painel administrativo', async () => {
  const home = await api('GET', '/qualquer/rota');
  assert.equal(home.status, 200);
  assert.match(home.data, /<html/i);

  const admin = await api('GET', '/admin');
  assert.equal(admin.status, 200);
  assert.match(admin.data, /Administra/);
});

// ---------------------------------------------------------------------------
// Regressoes de seguranca (achados da revisao de seguranca).

test('seguranca: cabecalhos e rotas desconhecidas', async () => {
  const { headers } = await api('GET', '/api/health');
  assert.match(headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-powered-by'), null);
  assert.equal(headers.get('access-control-allow-origin'), null, 'CORS aberto foi removido');

  const missing = await api('GET', '/api/nao-existe');
  assert.equal(missing.status, 404);
  assert.equal(typeof missing.data, 'object');

  const malformed = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"username":',
  });
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(await malformed.text(), /SyntaxError|at JSON/);
});

test('seguranca: tamanho forjado nao zera o preco e quantidade e limitada', async () => {
  const product = await api('POST', '/api/products', {
    token: ownerToken,
    body: { name: 'Pizza Tamanhos', category: 'Pizzas Salgadas e Doces', price: 40, sizePrices: { media: 40, grande: 50 } },
  });
  assert.equal(product.status, 201);

  for (const size of ['constructor', '__proto__', 'toString', 'gigante']) {
    const forged = await api('POST', '/api/orders', {
      body: { orderMode: 'retirada', items: [{ productId: product.data.id, size }] },
    });
    assert.equal(forged.status, 400, `tamanho "${size}" deveria ser recusado`);
  }

  const ok = await api('POST', '/api/orders', {
    body: { orderMode: 'retirada', items: [{ productId: product.data.id, size: 'grande', quantity: 1e9 }] },
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.resumo.items[0].quantity, 50);
  assert.equal(ok.data.resumo.total, 50 * 50);
});

test('seguranca: pedido comum nao finge pagamento online nem identidade', async () => {
  const menu = (await api('GET', '/api/menu')).data;
  const created = await api('POST', '/api/orders', {
    body: {
      orderMode: 'retirada',
      paymentMethod: 'cartao',
      customerLogin: 'cliente',
      deliveryLocation: 'Rua da Vitima, 10',
      customerPhone: '81 9999-0000<script>',
      items: [{ productId: menu[0].id }],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.order.payment_method, 'dinheiro');
  assert.equal(created.data.order.customer_login, null);
  assert.equal(created.data.order.delivery_location, 'Retirada no balcão');
  assert.equal(created.data.resumo.deliveryFee, 0);
  assert.doesNotMatch(created.data.order.customer_phone, /[<>]/);

  const tracked = await api('GET', `/api/orders/code/${created.data.order.order_code}`);
  assert.equal(tracked.data.deliveryLocation, undefined, 'acompanhamento publico nao mostra endereco');
});

test('seguranca: cozinha nao confirma pagamento e funcionario removido perde acesso', async () => {
  const kitchen = await api('POST', '/api/admin/users', {
    token: ownerToken,
    body: { username: 'cozinha2', password: 'senha-cozinha', role: 'cozinha' },
  });
  assert.equal(kitchen.status, 201);
  const kitchenToken = await login('cozinha2', 'senha-cozinha');

  const menu = (await api('GET', '/api/menu')).data;
  const pix = await api('POST', '/api/payments/pix', { body: { orderMode: 'retirada', items: [{ productId: menu[0].id }] } });
  const orderId = pix.data.order.id;

  const denied = await api('PATCH', `/api/orders/${orderId}/status`, { token: kitchenToken, body: { status: 'em-preparo' } });
  assert.equal(denied.status, 403);
  const confirmed = await api('PATCH', `/api/orders/${orderId}/status`, { token: ownerToken, body: { status: 'em-preparo' } });
  assert.equal(confirmed.status, 200);

  assert.equal((await api('DELETE', `/api/admin/users/${kitchen.data.id}`, { token: ownerToken })).status, 204);
  assert.equal((await api('GET', '/api/orders', { token: kitchenToken })).status, 401, 'token antigo deixa de valer');
});

test('seguranca: imagem de produto e upload validados', async () => {
  const bad = await api('POST', '/api/products', {
    token: ownerToken,
    body: { name: 'X', category: 'Bebidas', price: 5, image: 'javascript:alert(1)' },
  });
  assert.equal(bad.status, 400);

  const quote = await api('POST', '/api/products', {
    token: ownerToken,
    body: { name: 'X', category: 'Bebidas', price: 5, image: 'https://x.com/a.png" onerror="alert(1)' },
  });
  assert.equal(quote.status, 400);

  const form = new FormData();
  form.append('image', new Blob(['<html>nao sou imagem</html>'], { type: 'image/png' }), 'falsa.png');
  const upload = await fetch(`${baseUrl}/api/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: form,
  });
  assert.equal(upload.status, 400);
});

test('seguranca: webhook do Mercado Pago exige assinatura quando configurada', async () => {
  const noId = await api('POST', '/api/payments/mercadopago/webhook', { body: { type: 'test' } });
  assert.equal(noId.status, 200);

  process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-de-teste';
  try {
    const forged = await api('POST', '/api/payments/mercadopago/webhook', {
      body: { data: { id: '123456' } },
      headers: { 'x-signature': 'ts=1,v1=deadbeef', 'x-request-id': 'abc' },
    });
    assert.equal(forged.status, 401);
  } finally {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  }
});

test('seguranca: forca bruta no login e bloqueada', async () => {
  let last;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    last = await api('POST', '/api/auth/login', { body: { username: 'alvo-forca-bruta', password: `tentativa-${attempt}` } });
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
});