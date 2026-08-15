const API_BASE = '/api';
const categoryOrder = ['Pizzas', 'Bebidas', 'Promos', 'Sobremesas'];
const SESSION_KEY = 'pl-pizzas-session';

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function makeIllustration(label, accent, secondary, emoji) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stop-color="${secondary}"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="600" height="420" rx="28" fill="url(#g)"/>
      <circle cx="300" cy="180" r="110" fill="rgba(255,255,255,0.2)"/>
      <text x="300" y="188" font-size="120" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
      <rect x="44" y="300" width="512" height="62" rx="18" fill="rgba(255,255,255,0.2)"/>
      <text x="300" y="338" font-size="26" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const FALLBACK_IMAGES = {
  'Calabresa': makeIllustration('Calabresa', '#d71920', '#ffe4e2', '🍕'),
  'Frango com Catupiry': makeIllustration('Frango com Catupiry', '#f59f1a', '#fff3d9', '🍗'),
  'Portuguesa': makeIllustration('Portuguesa', '#d71920', '#fff0e8', '🍕'),
  'Margherita': makeIllustration('Margherita', '#a6d65a', '#edf8d9', '🍕'),
  'Pepperoni': makeIllustration('Pepperoni', '#c53d25', '#ffe0dc', '🌶️'),
  'Chocolate com Morango': makeIllustration('Chocolate com Morango', '#a52d62', '#fce4ef', '🍫'),
  'Banana com Canela': makeIllustration('Banana com Canela', '#e7a84d', '#fff0d7', '🍌'),
  'Guaraná de 1L': makeIllustration('Guaraná', '#d71920', '#ffe1df', '🥤'),
  'Água Mineral': makeIllustration('Água', '#38a4d8', '#ddf4ff', '💧'),
  'Pepsi 1L': makeIllustration('Pepsi', '#1d4d9a', '#dfe9ff', '🥤'),
  'H2OH Limoneto 500ml': makeIllustration('Limoneto', '#46c297', '#e1fdf1', '🍋'),
  'Coca Cola de 1.5L': makeIllustration('Coca Cola', '#b81d20', '#ffe2e0', '🥤'),
  'Coca Cola zero 1,5L': makeIllustration('Coca Zero', '#2d5ea8', '#dfe8ff', '🥤'),
  'Combo Família': makeIllustration('Combo Família', '#d71920', '#ffe9d4', '🎉'),
  'Petit Gateau': makeIllustration('Petit Gateau', '#7b4b2f', '#f5e3d9', '🍰'),
  Bebidas: makeIllustration('Bebidas', '#3fa1d8', '#dff6ff', '🥤'),
  Pizzas: makeIllustration('Pizzas', '#d71920', '#ffe6df', '🍕'),
  Promos: makeIllustration('Promo', '#e99e1f', '#fff4d6', '🎉'),
  Sobremesas: makeIllustration('Sobremesas', '#a33a68', '#f9e2ef', '🍰'),
  bebidas: makeIllustration('Bebidas', '#3fa1d8', '#dff6ff', '🥤'),
  pizzas: makeIllustration('Pizzas', '#d71920', '#ffe6df', '🍕'),
};

const state = {
  category: 'Pizzas',
  search: '',
  items: [],
  cart: [],
};

const menuGrid = document.getElementById('menuGrid');
const searchInput = document.getElementById('searchInput');
const categoryTabs = document.getElementById('categoryTabs');
const template = document.getElementById('menuItemTemplate');
const cartButton = document.getElementById('cartButton');
const cartCount = document.getElementById('cartCount');
const cartItems = document.getElementById('cartItems');
const subtotalValue = document.getElementById('subtotalValue');
const deliveryValue = document.getElementById('deliveryValue');
const totalValue = document.getElementById('totalValue');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutMessage = document.getElementById('checkoutMessage');
const pixResult = document.getElementById('pixResult');
const pixQrImage = document.getElementById('pixQrImage');
const pixCopyPaste = document.getElementById('pixCopyPaste');
const pixCopyButton = document.getElementById('pixCopyButton');
const pixOrderId = document.getElementById('pixOrderId');
const paymentStatusBanner = document.getElementById('paymentStatusBanner');
const paymentStatusTag = document.getElementById('paymentStatusTag');
const paymentStatusMessage = document.getElementById('paymentStatusMessage');
const sidebarMenu = document.getElementById('sidebarMenu');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const guestSidebar = document.getElementById('guestSidebar');
const customerSidebar = document.getElementById('customerSidebar');
const sideLoginForm = document.getElementById('sideLoginForm');
const sidebarLoginMessage = document.getElementById('sidebarLoginMessage');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarPassword = document.getElementById('sidebarPassword');
const customerGreeting = document.getElementById('customerGreeting');
const customerDashboardSection = document.getElementById('customerDashboardSection');
const customerPanelBody = document.getElementById('customerPanelBody');
const registerCustomerButton = document.getElementById('registerCustomerButton');
const sidebarLogout = document.getElementById('sidebarLogout');
const adminPanelButton = document.getElementById('adminPanelButton');
const storeStatusBanner = document.getElementById('storeStatusBanner');
const storeBrandName = document.getElementById('storeBrandName');
const storeBrandSubtitle = document.getElementById('storeBrandSubtitle');
const storeAddressText = document.getElementById('storeAddressText');

async function loadStoreSettings() {
  try {
    const response = await fetch('/api/store/settings', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (storeBrandName) {
      storeBrandName.textContent = data.company_name || 'PL Pizzas';
    }
    if (storeBrandSubtitle) {
      storeBrandSubtitle.textContent = data.phone ? `Contato: ${data.phone}` : 'Pizza artesanal';
    }
    if (storeAddressText) {
      storeAddressText.innerHTML = `${data.address || 'Santo Amaro, Recife - PE'}<br />${data.isOpen ? 'Aberto e pronto para receber você com o melhor sabor.' : 'Loja fechada no momento.'}`;
    }

    const isOpen = Boolean(Number(data.is_open ?? 1));
    const checkoutButton = document.querySelector('#checkoutForm button[type="submit"]');
    if (checkoutButton) {
      checkoutButton.disabled = !isOpen;
      checkoutButton.style.opacity = isOpen ? '1' : '0.6';
      checkoutButton.textContent = isOpen ? 'Confirmar pedido' : 'Loja fechada';
    }

    if (storeStatusBanner) {
      storeStatusBanner.classList.toggle('hidden', isOpen);
    }
  } catch {
    // ignore and keep default storefront copy
  }
}

function toCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

function resolveItemImage(item) {
  if (typeof item.image === 'string' && item.image.startsWith('http')) {
    return item.image;
  }

  if (item.name && FALLBACK_IMAGES[item.name]) {
    return FALLBACK_IMAGES[item.name];
  }

  if (item.category && FALLBACK_IMAGES[item.category]) {
    return FALLBACK_IMAGES[item.category];
  }

  return FALLBACK_IMAGES.pizzas;
}

function buildCartKey(entry) {
  return `${entry.id}-${entry.mode}-${entry.split}-${(entry.extras || []).join('|')}`;
}

function addToCart(item, options = {}) {
  const cartEntry = {
    id: item.id,
    name: item.name,
    price: Number(item.price),
    image: resolveItemImage(item),
    mode: options.mode || 'tradicional',
    split: options.split || 'normal',
    extras: options.extras || [],
  };

  const key = buildCartKey(cartEntry);
  const existingIndex = state.cart.findIndex((entry) => buildCartKey(entry) === key);

  if (existingIndex >= 0) {
    state.cart[existingIndex].quantity += 1;
  } else {
    state.cart.push({ ...cartEntry, quantity: 1, key });
  }

  renderCart();
}

function renderCart() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = totalItems;

  if (!state.cart.length) {
    cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio. Escolha uma pizza ou bebida para começar.</div>';
    subtotalValue.textContent = 'R$ 0,00';
    deliveryValue.textContent = 'R$ 0,00';
    totalValue.textContent = 'R$ 0,00';
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = subtotal > 80 ? 0 : 9.9;
  const total = subtotal + delivery;

  cartItems.innerHTML = state.cart
    .map(
      (item) => `
        <article class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="cart-details">
            <div class="cart-header">
              <h4>${item.name}</h4>
              <strong>${toCurrency(item.price * item.quantity)}</strong>
            </div>
            <div class="cart-meta">${item.mode} • ${item.split === 'metade' ? 'Meia e meia' : 'Normal'}${item.extras.length ? ` • ${item.extras.join(', ')}` : ''}</div>
            <div class="cart-controls">
              <button type="button" data-action="decrease" data-key="${item.key}">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" data-key="${item.key}">+</button>
            </div>
          </div>
        </article>
      `
    )
    .join('');

  subtotalValue.textContent = toCurrency(subtotal);
  deliveryValue.textContent = toCurrency(delivery);
  totalValue.textContent = toCurrency(total);

  cartItems.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const { action, key } = button.dataset;
      const index = state.cart.findIndex((item) => item.key === key);
      if (index < 0) return;

      if (action === 'increase') {
        state.cart[index].quantity += 1;
      } else if (action === 'decrease') {
        state.cart[index].quantity -= 1;
      }

      if (state.cart[index].quantity <= 0) {
        state.cart.splice(index, 1);
      }

      renderCart();
    });
  });
}

async function fetchMenu(category = null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const response = await fetch(`${API_BASE}/menu${query}`);
  if (!response.ok) {
    throw new Error('Não foi possível carregar o cardápio.');
  }
  return response.json();
}

function renderCategories(items) {
  const categories = [...new Set(items.map((item) => item.category))];
  const available = categoryOrder.filter((category) => categories.includes(category));
  const others = categories.filter((category) => !categoryOrder.includes(category));
  const allCategories = [...available, ...others];

  categoryTabs.innerHTML = '';
  allCategories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-tab ${state.category === category ? 'active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      state.category = category;
      renderMenu();
    });
    categoryTabs.appendChild(button);
  });
}

function matchesSearch(item) {
  const search = state.search.trim().toLowerCase();
  if (!search) return true;
  return (
    item.name.toLowerCase().includes(search) ||
    (item.ingredients || '').toLowerCase().includes(search) ||
    item.description.toLowerCase().includes(search)
  );
}

function renderMenu() {
  const filtered = state.items.filter((item) => item.category === state.category).filter(matchesSearch);

  menuGrid.innerHTML = '';
  if (!filtered.length) {
    menuGrid.innerHTML = '<p class="empty-state">Nenhum item encontrado para essa busca.</p>';
    return;
  }

  filtered.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const image = fragment.querySelector('[data-role="image"]');
    const name = fragment.querySelector('[data-role="name"]');
    const price = fragment.querySelector('[data-role="price"]');
    const description = fragment.querySelector('[data-role="description"]');
    const ingredients = fragment.querySelector('[data-role="ingredients"]');
    const button = fragment.querySelector('button');
    const modeSelect = fragment.querySelector('[data-role="mode"]');

    image.src = resolveItemImage(item);
    image.alt = item.name;
    name.textContent = item.name;
    price.textContent = toCurrency(item.price);
    description.textContent = item.description;

    if (item.ingredients) {
      item.ingredients.split(',').forEach((ingredient) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = ingredient.trim();
        ingredients.appendChild(tag);
      });
    }

    const splitName = `split-${item.id}`;
    fragment.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.name = splitName;
    });

    button.addEventListener('click', () => {
      const selectedMode = modeSelect.value;
      const split = fragment.querySelector('input[type="radio"]:checked')?.value || 'normal';
      const extras = Array.from(fragment.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);

      addToCart(item, { mode: selectedMode, split, extras });
      document.getElementById('checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    menuGrid.appendChild(fragment);
  });
}

async function initMenu() {
  try {
    const items = await fetchMenu();
    state.items = items;
    if (!state.category && items.length > 0) {
      state.category = items[0].category;
    }
    renderCategories(items);
    renderMenu();
    renderCart();
  } catch (error) {
    menuGrid.innerHTML = `<p class="empty-state">${error.message}</p>`;
  }
}

searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderMenu();
});

cartButton.addEventListener('click', () => {
  document.getElementById('checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function openSidebar() {
  sidebarMenu.classList.add('open');
}

function closeSidebar() {
  sidebarMenu.classList.remove('open');
}

function updateSidebarAccess() {
  const session = getSession();
  const isAdmin = session.user?.role === 'admin';
  const isLoggedIn = Boolean(session.token);

  guestSidebar.classList.toggle('hidden', isLoggedIn);
  customerSidebar.classList.toggle('hidden', !isLoggedIn);

  if (adminPanelButton) {
    adminPanelButton.classList.toggle('hidden', !isAdmin);
  }

  if (session.user?.name || session.user?.username) {
    customerGreeting.textContent = `Olá, ${session.user.name || session.user.username}!`;
  }
}

function renderClientDashboard(mode = 'history') {
  const session = getSession();
  if (!session.token) {
    return;
  }

  customerDashboardSection.classList.remove('hidden');
  customerGreeting.textContent = `Olá, ${session.user?.name || session.user?.username || 'cliente'}!`;

  if (mode === 'history') {
    customerPanelBody.innerHTML = `
      <div>
        <h4>Histórico de compras</h4>
        <div class="customer-list">
          <div class="row-item"><strong>Último pedido:</strong> Pedido em preparação.</div>
          <div class="row-item"><strong>Quantidade de pedidos:</strong> ${session.user?.orderCount || 1}</div>
          <div class="row-item"><strong>Pagamento preferencial:</strong> ${session.user?.paymentKey || 'PIX'}</div>
        </div>
      </div>
    `;
  }

  if (mode === 'status') {
    customerPanelBody.innerHTML = `
      <div>
        <h4>Status atual do pedido</h4>
        <div class="customer-orders">
          <div class="order-item"><strong>Status:</strong> Em preparo</div>
          <div class="order-item"><strong>Local de entrega:</strong> Casa / Rua principal</div>
          <div class="order-item"><strong>Pagamento:</strong> Pix</div>
        </div>
      </div>
    `;
  }
}

async function loginFromSidebar() {
  const username = sidebarUsername.value.trim();
  const password = sidebarPassword.value;

  if (!username || !password) {
    sidebarLoginMessage.textContent = 'Informe usuário e senha.';
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Falha ao autenticar.');
    }

    setSession({ token: data.token, user: data.user });
    updateSidebarAccess();
    sidebarLoginMessage.textContent = '';
    closeSidebar();
    if (data.user.role === 'admin') {
      renderClientDashboard('history');
    } else {
      renderClientDashboard('history');
    }
  } catch (error) {
    sidebarLoginMessage.textContent = error.message;
  }
}

async function registerCustomer() {
  const name = window.prompt('Qual o nome do cliente?');
  const login = window.prompt('Digite o login desejado:');
  const password = window.prompt('Digite a senha:');

  if (!name || !login || !password) {
    sidebarLoginMessage.textContent = 'Preencha nome, login e senha para cadastrar.';
    return;
  }

  try {
    const response = await fetch('/api/customers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, login, password, paymentKey: `PAY-${Date.now()}` }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao cadastrar cliente.');
    }

    sidebarLoginMessage.textContent = 'Cliente cadastrado com sucesso. Faça login agora.';
  } catch (error) {
    sidebarLoginMessage.textContent = error.message;
  }
}

function logoutCustomer() {
  clearSession();
  updateSidebarAccess();
  customerDashboardSection.classList.add('hidden');
  sidebarUsername.value = '';
  sidebarPassword.value = '';
  sidebarLoginMessage.textContent = '';
}

async function submitOrder(endpoint, payload, session) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível confirmar o pedido.');
  }

  return data;
}

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  pixResult.classList.add('hidden');

  try {
    const settings = await fetch('/api/store/settings').then((response) => response.ok ? response.json() : null);
    if (settings && !Number(settings.is_open)) {
      checkoutMessage.textContent = 'A loja está fechada no momento. Tente novamente em outro horário.';
      checkoutMessage.style.color = '#d71920';
      return;
    }
  } catch {
    // ignore and continue when settings endpoint is unavailable
  }

  if (!state.cart.length) {
    checkoutMessage.textContent = 'Adicione pelo menos um item ao carrinho antes de confirmar o pedido.';
    checkoutMessage.style.color = '#d71920';
    return;
  }

  const formData = new FormData(checkoutForm);
  const customerName = formData.get('name')?.toString().trim();
  const session = getSession();
  const paymentMethod = formData.get('payment')?.toString() || 'pix';
  const orderItems = state.cart.map((item) => ({
    name: item.name,
    description: `${item.mode} • ${item.split} • ${item.extras.join(', ') || 'Sem extras'}`,
    quantity: item.quantity,
    price: item.price,
    itemTotal: item.price * item.quantity,
  }));

  const payload = {
    customerName,
    customerLogin: session.user?.username || null,
    deliveryLocation: formData.get('address')?.toString().trim(),
    paymentMethod,
    items: orderItems,
  };

  try {
    if (paymentMethod === 'cartao') {
      const data = await submitOrder('/api/payments/mercadopago/preference', payload, session);
      checkoutMessage.textContent = 'Redirecionando para o pagamento seguro do Mercado Pago...';
      checkoutMessage.style.color = '#1d9d5c';
      window.location.href = data.initPoint;
      return;
    }

    if (paymentMethod === 'pix') {
      const data = await submitOrder('/api/payments/pix', payload, session);
      pixOrderId.textContent = data.order.id;
      pixQrImage.src = data.qrCodeDataUrl;
      pixCopyPaste.value = data.pixPayload;
      pixResult.classList.remove('hidden');
      pixResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
      checkoutMessage.textContent = '';
      state.cart = [];
      renderCart();
      checkoutForm.reset();
      return;
    }

    const data = await submitOrder('/api/orders', payload, session);
    checkoutMessage.textContent = `Pedido confirmado para ${customerName || 'cliente'}! ID do pedido: ${data.order.id}.`;
    checkoutMessage.style.color = '#1d9d5c';
    state.cart = [];
    renderCart();
    checkoutForm.reset();
  } catch (error) {
    checkoutMessage.textContent = error.message;
    checkoutMessage.style.color = '#d71920';
  }
});

if (pixCopyButton) {
  pixCopyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste.value);
      pixCopyButton.textContent = 'Código copiado!';
      setTimeout(() => {
        pixCopyButton.textContent = 'Copiar código Pix';
      }, 2000);
    } catch {
      pixCopyPaste.select();
      document.execCommand('copy');
    }
  });
}

(function showPaymentReturnBanner() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment');
  if (!status || !paymentStatusBanner) return;

  const messages = {
    success: { tag: 'Pagamento aprovado', message: 'Seu pagamento foi aprovado! Já enviamos seu pedido para o preparo.', color: '#1d9d5c' },
    pending: { tag: 'Pagamento pendente', message: 'Seu pagamento está sendo processado. Assim que for aprovado, o preparo começa.', color: '#d98b1d' },
    failure: { tag: 'Pagamento não aprovado', message: 'Não foi possível concluir o pagamento. Tente novamente ou escolha outra forma de pagamento.', color: '#cf2f3d' },
  };

  const info = messages[status];
  if (!info) return;

  paymentStatusTag.textContent = info.tag;
  paymentStatusMessage.textContent = info.message;
  paymentStatusBanner.style.borderColor = info.color;
  paymentStatusBanner.classList.remove('hidden');
})();

sidebarToggle.addEventListener('click', () => {
  const isOpen = sidebarMenu.classList.contains('open');
  if (isOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarClose.addEventListener('click', closeSidebar);
sideLoginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loginFromSidebar();
});
registerCustomerButton.addEventListener('click', registerCustomer);
sidebarLogout.addEventListener('click', logoutCustomer);

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.view;
    if (mode === 'menu') {
      closeSidebar();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    renderClientDashboard(mode);
  });
});

if (adminPanelButton) {
  adminPanelButton.addEventListener('click', () => {
    window.location.href = '/admin';
  });
}

const session = getSession();
if (session.token) {
  updateSidebarAccess();
  renderClientDashboard('history');
}

loadStoreSettings();
initMenu();
