const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const summaryGrid = document.getElementById('summaryGrid');
const tableList = document.getElementById('tableList');
const logoutButton = document.getElementById('logoutButton');
const tableNameInput = document.getElementById('tableName');
const tableCapacityInput = document.getElementById('tableCapacity');
const createTableButton = document.getElementById('createTableButton');
const customersList = document.getElementById('customersList');
const productsList = document.getElementById('productsList');
const ordersList = document.getElementById('ordersList');
const productForm = document.getElementById('productForm');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');
const productCategory = document.getElementById('productCategory');
const foodFields = document.getElementById('foodFields');
const drinkFields = document.getElementById('drinkFields');

const statusMap = {
  available: 'Disponível',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  cleaning: 'Aguardando Limpeza',
};

const orderStatusMap = {
  'em-preparo': 'Em preparo',
  pronto: 'Pronto',
  'em-entrega': 'Em entrega',
  entregue: 'Entregue',
};

function setToken(token) {
  localStorage.setItem('pizzaria-token', token);
}

function getToken() {
  return localStorage.getItem('pizzaria-token');
}

function clearToken() {
  localStorage.removeItem('pizzaria-token');
}

function maskPaymentKey(value) {
  if (!value) return 'Não informado';
  const trimmed = String(value).trim();
  const lastFour = trimmed.slice(-4).padStart(4, '*');
  return `**** ${lastFour}`;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    if (loginView && dashboardView) {
      showLogin();
    }
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Erro inesperado.');
  }

  return response.json();
}

function showLogin() {
  if (loginView && dashboardView) {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

function showDashboard() {
  if (loginView && dashboardView) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
}

function renderSummary(summary) {
  if (!summaryGrid) return;

  const cards = [
    { label: 'Livres', value: summary.available, tone: 'success' },
    { label: 'Ocupadas', value: summary.occupied, tone: 'danger' },
    { label: 'Reservadas', value: summary.reserved, tone: 'warning' },
    { label: 'Limpando', value: summary.cleaning, tone: 'neutral' },
  ];

  summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="summary-card">
          <span class="label">${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `
    )
    .join('');
}

function renderTableList(tables) {
  if (!tableList) return;

  tableList.innerHTML = tables
    .map(
      (table) => `
        <article class="table-card">
          <div class="row">
            <h3>${table.name}</h3>
            <span class="table-status" data-status="${table.status}">${statusMap[table.status] || table.status}</span>
          </div>
          <div class="capacity">Capacidade: ${table.capacity} lugares</div>
          <div class="type-actions">
            <button class="inline-button primary" data-action="next" data-id="${table.id}" type="button">Próximo status</button>
            <button class="inline-button" data-action="toggle" data-id="${table.id}" type="button">1 clique</button>
          </div>
        </article>
      `
    )
    .join('');

  tableList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const { id, action } = button.dataset;
      const table = tables.find((item) => String(item.id) === id);
      if (!table) return;

      const nextStatus = action === 'next' ? nextTableStatus(table.status) : toggleStatus(table.status);
      await updateTableStatus(Number(id), nextStatus);
    });
  });
}

function nextTableStatus(current) {
  const order = ['available', 'occupied', 'reserved', 'cleaning'];
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}

function toggleStatus(current) {
  return current === 'available' ? 'occupied' : current === 'occupied' ? 'available' : current;
}

async function updateTableStatus(id, status) {
  try {
    const updated = await apiFetch(`/api/tables/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    await loadTables();
    console.log('Mesa atualizada:', updated);
  } catch (error) {
    if (loginMessage) loginMessage.textContent = error.message;
  }
}

async function loadTables() {
  try {
    const data = await apiFetch('/api/tables');
    renderSummary(data.summary);
    renderTableList(data.tables);
  } catch (error) {
    if (loginMessage) loginMessage.textContent = error.message;
  }
}

function renderCustomers(customers) {
  if (!customersList) return;

  customersList.innerHTML = customers.length
    ? `
      <div class="customer-table-grid">
        ${customers
          .map(
            (customer) => `
              <article class="table-card">
                <div class="row">
                  <h3>${customer.name}</h3>
                  <span class="table-status" data-status="available">Cliente</span>
                </div>
                <div class="capacity"><strong>ID:</strong> ${customer.id}</div>
                <div class="capacity"><strong>Nome:</strong> ${customer.name}</div>
                <div class="capacity"><strong>Login:</strong> ${customer.login}</div>
                <div class="capacity"><strong>Pagamentos:</strong> ${maskPaymentKey(customer.payment_key)}</div>
                <div class="capacity"><strong>Pedidos:</strong> ${customer.order_count || 0}</div>
              </article>
            `
          )
          .join('')}
      </div>
    `
    : '<p>Nenhum cliente cadastrado.</p>';
}

async function loadCustomers() {
  try {
    const customers = await apiFetch('/api/customers');
    renderCustomers(customers);
  } catch (error) {
    if (customersList) customersList.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderProducts(products) {
  if (!productsList) return;

  productsList.innerHTML = products.length
    ? products
        .map(
          (product) => `
            <article class="table-card">
              <div class="row">
                <h3>${product.name}</h3>
                <span class="table-status" data-status="available">${product.category}</span>
              </div>
              <div class="capacity"><strong>Descrição:</strong> ${product.description || 'Sem descrição'}</div>
              <div class="capacity"><strong>Valor:</strong> R$ ${Number(product.price || 0).toFixed(2)}</div>
              <div class="capacity"><strong>Sabores:</strong> ${product.flavors || '—'}</div>
              <div class="capacity"><strong>Tamanhos:</strong> ${product.sizes || '—'}</div>
              <div class="capacity"><strong>Borda:</strong> ${product.dough_type || '—'}</div>
              <div class="capacity"><strong>Medida:</strong> ${product.measure || '—'}</div>
            </article>
          `
        )
        .join('')
    : '<p>Nenhum produto cadastrado.</p>';
}

async function loadProducts() {
  try {
    const products = await apiFetch('/api/menu');
    renderProducts(products);
  } catch (error) {
    if (productsList) productsList.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderOrders(orders) {
  if (!ordersList) return;

  ordersList.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
            <article class="table-card">
              <div class="row">
                <h3>Pedido #${order.id}</h3>
                <span class="table-status" data-status="available">${orderStatusMap[order.status] || order.status}</span>
              </div>
              <div class="capacity"><strong>Cliente:</strong> ${order.customer_name || 'Cliente'}</div>
              <div class="capacity"><strong>Local:</strong> ${order.delivery_location || 'Sem endereço'}</div>
              <div class="capacity"><strong>Pagamento:</strong> ${order.payment_method || '—'}</div>
              <div class="capacity"><strong>Valor total:</strong> R$ ${Number(order.total_value || 0).toFixed(2)}</div>
              <div class="capacity"><strong>Itens:</strong> ${order.items?.map((item) => `${item.product_name} x ${item.quantity}`).join(', ') || 'Nenhum item'}</div>
              <div class="type-actions">
                <button class="inline-button primary" data-order-status="pronto" data-order-id="${order.id}" type="button">Pronto</button>
                <button class="inline-button" data-order-status="em-entrega" data-order-id="${order.id}" type="button">Entrega</button>
              </div>
            </article>
          `
        )
        .join('')
    : '<p>Nenhum pedido encontrado.</p>';

  ordersList.querySelectorAll('[data-order-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      const status = button.dataset.orderStatus;
      const id = button.dataset.orderId;
      await apiFetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadOrders();
    });
  });
}

async function loadOrders() {
  try {
    const orders = await apiFetch('/api/orders');
    renderOrders(orders);
  } catch (error) {
    if (ordersList) ordersList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function handleProductCreate(event) {
  event.preventDefault();
  if (!productForm) return;

  const payload = {
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value,
    price: Number(document.getElementById('productPrice').value),
    image: document.getElementById('productImage').value.trim(),
    description: document.getElementById('productDescription').value.trim(),
    flavors: document.getElementById('productFlavors').value.trim(),
    sizes: document.getElementById('productSizes').value.trim(),
    doughType: document.getElementById('productDoughType').value.trim(),
    measure: document.getElementById('productMeasure').value.trim(),
  };

  try {
    await apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    productForm.reset();
    loadProducts();
  } catch (error) {
    if (productsList) productsList.innerHTML = `<p>${error.message}</p>`;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loginMessage) loginMessage.textContent = '';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const data = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const body = await data.json();
      if (!data.ok) {
        throw new Error(body.message || 'Falha ao autenticar.');
      }

      setToken(body.token);
      showDashboard();
      await loadTables();
    } catch (error) {
      if (loginMessage) loginMessage.textContent = error.message;
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    clearToken();
    showLogin();
    if (loginForm) loginForm.reset();
    if (loginMessage) loginMessage.textContent = '';
  });
}

if (createTableButton) {
  createTableButton.addEventListener('click', async () => {
    const name = tableNameInput.value.trim();
    const capacity = Number(tableCapacityInput.value);

    if (!name || !capacity || capacity <= 0) {
      if (loginMessage) loginMessage.textContent = 'Informe nome da mesa e capacidade válida.';
      return;
    }

    try {
      await apiFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify({ name, capacity }),
      });

      tableNameInput.value = '';
      tableCapacityInput.value = '';
      if (loginMessage) loginMessage.textContent = '';
      await loadTables();
    } catch (error) {
      if (loginMessage) loginMessage.textContent = error.message;
    }
  });
}

if (adminMenuToggle && adminSidebar) {
  adminMenuToggle.addEventListener('click', () => {
    const isOpen = adminSidebar.classList.toggle('open');
    adminMenuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

if (productCategory && foodFields && drinkFields) {
  const updateProductFields = () => {
    const category = productCategory.value;
    const isFood = category === 'Comida' || category === 'Pizza';
    const isDrink = category === 'Bebida';

    foodFields.classList.toggle('hidden', !isFood);
    drinkFields.classList.toggle('hidden', !isDrink);
  };

  productCategory.addEventListener('change', updateProductFields);
  updateProductFields();
}

if (productForm) {
  productForm.addEventListener('submit', handleProductCreate);
}

if (getToken()) {
  if (loginView && dashboardView) {
    showDashboard();
    loadTables();
  }
  if (customersList) loadCustomers();
  if (productsList) loadProducts();
  if (ordersList) loadOrders();
} else {
  if (loginView && dashboardView) {
    showLogin();
  }
  if (customersList) customersList.innerHTML = '<p>Faça login como administrador para ver os clientes.</p>';
  if (productsList) productsList.innerHTML = '<p>Faça login como administrador para ver os produtos.</p>';
  if (ordersList) ordersList.innerHTML = '<p>Faça login como administrador para ver os pedidos.</p>';
}

