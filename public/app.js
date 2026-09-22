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
  deliveryFee: 9.9,
  freeDeliveryMin: 80,
  isOpen: true,
  extras: [],
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
const storeBrandLogo = document.getElementById('storeBrandLogo');
const storeBrandSubtitle = document.getElementById('storeBrandSubtitle');
const storeAddressText = document.getElementById('storeAddressText');
const modeOptions = document.querySelectorAll('[data-mode]');
const locationButton = document.getElementById('locationButton');
const locationLabel = document.getElementById('locationLabel');
const locationValue = document.getElementById('locationValue');
const cartTotalLabel = document.getElementById('cartTotalLabel');
const addressModal = document.getElementById('addressModal');
const addressModalClose = document.getElementById('addressModalClose');
const addressForm = document.getElementById('addressForm');
const addressStreet = document.getElementById('addressStreet');
const addressNeighborhood = document.getElementById('addressNeighborhood');
const addressComplement = document.getElementById('addressComplement');
const addressMessage = document.getElementById('addressMessage');
const menuGate = document.getElementById('menuGate');
const menuFilters = document.getElementById('menu');
const menuSection = document.getElementById('menuSection');
const checkoutSection = document.getElementById('checkout');
const gateAddressButton = document.getElementById('gateAddressButton');
const gatePickupButton = document.getElementById('gatePickupButton');
const checkoutAddressRow = document.getElementById('checkoutAddressRow');
const checkoutAddressLabel = document.getElementById('checkoutAddressLabel');
const checkoutAddress = document.getElementById('checkoutAddress');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const accountButton = document.getElementById('accountButton');
const topbarGuestActions = document.getElementById('topbarGuestActions');
const topbarUserActions = document.getElementById('topbarUserActions');

const ORDER_MODE_KEY = 'pl-pizzas-order-mode';
const ADDRESS_KEY = 'pl-pizzas-address';

const modeLabels = {
  delivery: 'Delivery',
  retirada: 'Retirada',
  local: 'Comer no local',
};

function getOrderMode() {
  const stored = localStorage.getItem(ORDER_MODE_KEY);
  return modeLabels[stored] ? stored : 'delivery';
}

function setOrderMode(mode) {
  localStorage.setItem(ORDER_MODE_KEY, mode);
}

function getAddress() {
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAddress(address) {
  localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
}

function formatAddress(address) {
  if (!address) return '';
  const main = [address.street, address.neighborhood].filter(Boolean).join(', ');
  return address.complement ? `${main} — ${address.complement}` : main;
}

function isDelivery() {
  return getOrderMode() === 'delivery';
}

function isMenuUnlocked() {
  return !isDelivery() || Boolean(getAddress());
}

function openAddressModal() {
  const address = getAddress();
  if (address) {
    addressStreet.value = address.street || '';
    addressNeighborhood.value = address.neighborhood || '';
    addressComplement.value = address.complement || '';
  }
  addressMessage.textContent = '';
  addressModal.classList.remove('hidden');
  addressStreet.focus();
}

function closeAddressModal() {
  addressModal.classList.add('hidden');
}

function applyOrderModeUI() {
  const mode = getOrderMode();
  const address = getAddress();
  const unlocked = isMenuUnlocked();

  modeOptions.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });

  if (isDelivery()) {
    locationLabel.textContent = 'Local';
    locationValue.textContent = address ? formatAddress(address) : 'Informe seu endereço';
    locationButton.classList.remove('hidden');
  } else {
    locationLabel.textContent = mode === 'retirada' ? 'Retirada' : 'Comer no local';
    locationValue.textContent = 'Na loja';
  }

  menuGate.classList.toggle('hidden', unlocked);
  menuFilters.classList.toggle('hidden', !unlocked);
  menuSection.classList.toggle('hidden', !unlocked);
  checkoutSection.classList.toggle('hidden', !unlocked);

  if (checkoutAddressRow) {
    checkoutAddressRow.classList.toggle('hidden', !isDelivery());
    checkoutAddress.required = isDelivery();
    if (isDelivery()) {
      checkoutAddressLabel.textContent = 'Endereço';
      if (address && !checkoutAddress.value) {
        checkoutAddress.value = formatAddress(address);
      }
    } else {
      checkoutAddress.value = '';
    }
  }

  renderCart();
}

function resolveDeliveryLocation(formAddress) {
  const mode = getOrderMode();
  if (mode === 'retirada') return 'Retirada no balcão';
  if (mode === 'local') return 'Consumo no local';
  return formAddress || formatAddress(getAddress()) || 'Entrega em domicílio';
}

async function fetchPublicSettings() {
  const response = await fetch('/api/store/public-settings', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar os dados da loja.');
  }

  return response.json();
}

async function loadStoreSettings() {
  try {
    const data = await fetchPublicSettings();

    state.deliveryFee = Number(data.deliveryFee || 0);
    state.freeDeliveryMin = Number(data.freeDeliveryMin ?? 80);
    state.isOpen = data.isOpen;
    renderCart();

    if (storeBrandName) {
      storeBrandName.textContent = data.companyName || 'PL Pizza';
    }
    if (storeBrandLogo && data.logoUrl) {
      storeBrandLogo.src = data.logoUrl;
    }
    if (storeBrandSubtitle) {
      storeBrandSubtitle.textContent = data.phone ? `Contato: ${data.phone}` : 'Pizza artesanal';
    }
    if (storeAddressText) {
      storeAddressText.innerHTML = `${data.address || 'Santo Amaro, Recife - PE'}<br />${data.isOpen ? 'Aberto e pronto para receber você com o melhor sabor.' : 'Loja fechada no momento.'}`;
    }

    applyStoreOpenState(data.isOpen);
  } catch {
    // mantém o conteúdo padrão da vitrine se a API não responder
  }
}

function applyStoreOpenState(isOpen) {
  const checkoutButton = document.querySelector('#checkoutForm button[type="submit"]');
  if (checkoutButton) {
    checkoutButton.disabled = !isOpen;
    checkoutButton.style.opacity = isOpen ? '1' : '0.6';
    checkoutButton.textContent = isOpen ? 'Confirmar pedido' : 'Loja fechada';
  }

  if (storeStatusBanner) {
    storeStatusBanner.classList.toggle('hidden', isOpen);
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
  return `${entry.id}-${entry.size || ''}-${entry.dough || ''}-${(entry.extraIds || []).join('|')}`;
}

// Precos de tamanho vem do painel (menu_items.size_prices).
function parseSizePrices(item) {
  if (!item.size_prices) return {};
  try {
    const parsed = JSON.parse(item.size_prices);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const SIZE_LABELS = { broto: 'Broto', media: 'Média', grande: 'Grande', gigante: 'Gigante' };

function availableSizes(item) {
  const sizePrices = parseSizePrices(item);
  return Object.entries(sizePrices)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, label: SIZE_LABELS[key] || key, price: Number(value) }));
}

// As categorias do cardapio variam entre singular e plural ("Pizza"/"Pizzas"),
// entao a comparacao normaliza acento, caixa e plural.
// Mesma regra em backend/pricing.js.
function normalizeCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/s$/, '');
}

// Um adicional sem categoria vale para tudo; com categoria, so para a dela.
function availableExtras(item) {
  return state.extras.filter(
    (extra) => !extra.category || normalizeCategory(extra.category) === normalizeCategory(item.category)
  );
}

function availableDoughs(item) {
  return String(item.dough_type || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function unitPriceFor(item, { size, extraIds = [] }) {
  const sizes = availableSizes(item);
  const chosenSize = sizes.find((entry) => entry.key === size);
  const base = chosenSize ? chosenSize.price : Number(item.price || 0);
  const extrasTotal = extraIds
    .map((id) => state.extras.find((extra) => extra.id === id))
    .filter(Boolean)
    .reduce((sum, extra) => sum + Number(extra.price || 0), 0);

  return base + extrasTotal;
}

function addToCart(item, options = {}) {
  const extraIds = options.extraIds || [];
  const cartEntry = {
    id: item.id,
    name: item.name,
    price: unitPriceFor(item, { size: options.size, extraIds }),
    image: resolveItemImage(item),
    size: options.size || null,
    dough: options.dough || null,
    extraIds,
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

async function loadSiteQrCode() {
  const image = document.getElementById('siteQrCode');
  const link = document.getElementById('siteQrLink');
  if (!image) return;

  try {
    const data = await fetch(`${API_BASE}/store/qrcode`).then((response) => response.json());
    image.src = data.dataUrl;
    if (link) link.href = data.url;
  } catch {
    image.closest('.qr-card')?.classList.add('hidden');
  }
}

function describeCartEntry(entry) {
  const extraNames = (entry.extraIds || [])
    .map((id) => state.extras.find((extra) => extra.id === id)?.name)
    .filter(Boolean);

  return [
    entry.size ? SIZE_LABELS[entry.size] || entry.size : null,
    entry.dough || null,
    extraNames.length ? extraNames.join(', ') : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function renderCart() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = totalItems;

  if (!state.cart.length) {
    cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio. Escolha uma pizza ou bebida para começar.</div>';
    subtotalValue.textContent = 'R$ 0,00';
    deliveryValue.textContent = 'R$ 0,00';
    totalValue.textContent = 'R$ 0,00';
    if (cartTotalLabel) cartTotalLabel.textContent = 'R$ 0,00';
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Mesma regra do servidor (backend/pricing.js): a exibicao nao pode divergir do cobrado.
  const freeFrom = Number(state.freeDeliveryMin ?? 80);
  const hasFreeDelivery = freeFrom > 0 && subtotal >= freeFrom;
  const delivery = isDelivery() && !hasFreeDelivery ? state.deliveryFee : 0;
  const total = subtotal + delivery;

  if (cartTotalLabel) cartTotalLabel.textContent = toCurrency(total);

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
            <div class="cart-meta">${describeCartEntry(item) || 'Padrão'}</div>
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
    const optionsHost = fragment.querySelector('[data-role="options"]');

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

    const sizes = availableSizes(item);
    const doughs = availableDoughs(item);
    const extras = availableExtras(item);

    if (sizes.length) {
      const group = document.createElement('div');
      group.className = 'option-group';
      group.innerHTML = `
        <label>
          <span>Tamanho</span>
          <select data-role="size">
            ${sizes.map((size) => `<option value="${size.key}">${size.label} — ${toCurrency(size.price)}</option>`).join('')}
          </select>
        </label>
      `;
      optionsHost.appendChild(group);
    }

    if (doughs.length) {
      const group = document.createElement('div');
      group.className = 'option-group';
      group.innerHTML = `
        <label>
          <span>Borda / massa</span>
          <select data-role="dough">
            ${doughs.map((dough) => `<option value="${dough}">${dough}</option>`).join('')}
          </select>
        </label>
      `;
      optionsHost.appendChild(group);
    }

    if (extras.length) {
      const group = document.createElement('div');
      group.className = 'option-group';
      group.innerHTML = `
        <span>Adicionais</span>
        <div class="checkbox-row">
          ${extras
            .map(
              (extra) =>
                `<label><input type="checkbox" data-role="extra" value="${extra.id}" /> ${extra.name} (+${toCurrency(extra.price)})</label>`
            )
            .join('')}
        </div>
      `;
      optionsHost.appendChild(group);
    }

    const sizeSelect = optionsHost.querySelector('[data-role="size"]');
    const doughSelect = optionsHost.querySelector('[data-role="dough"]');

    // O preco do cartao acompanha o tamanho e os adicionais escolhidos.
    const refreshPrice = () => {
      const extraIds = Array.from(optionsHost.querySelectorAll('[data-role="extra"]:checked')).map((input) =>
        Number(input.value)
      );
      price.textContent = toCurrency(unitPriceFor(item, { size: sizeSelect?.value, extraIds }));
    };

    optionsHost.querySelectorAll('select, input[type="checkbox"]').forEach((control) => {
      control.addEventListener('change', refreshPrice);
    });
    refreshPrice();

    button.addEventListener('click', () => {
      const extraIds = Array.from(optionsHost.querySelectorAll('[data-role="extra"]:checked')).map((input) =>
        Number(input.value)
      );

      addToCart(item, { size: sizeSelect?.value || null, dough: doughSelect?.value || null, extraIds });
      document.getElementById('checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    menuGrid.appendChild(fragment);
  });
}

async function initMenu() {
  try {
    const [items, extras] = await Promise.all([
      fetchMenu(),
      fetch(`${API_BASE}/extras`)
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ]);

    state.items = items;
    state.extras = extras;

    // A categoria padrão pode não existir no cardápio real; cai para a primeira disponível.
    const availableCategories = [...new Set(items.map((item) => item.category))];
    if (items.length > 0 && !availableCategories.includes(state.category)) {
      state.category = availableCategories[0];
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
  if (!isMenuUnlocked()) {
    openAddressModal();
    return;
  }
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

  if (topbarGuestActions && topbarUserActions) {
    topbarGuestActions.classList.toggle('hidden', isLoggedIn);
    topbarUserActions.classList.toggle('hidden', !isLoggedIn);
  }

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
    const settings = await fetchPublicSettings();
    state.deliveryFee = Number(settings.deliveryFee || 0);
    state.freeDeliveryMin = Number(settings.freeDeliveryMin ?? 80);
    state.isOpen = settings.isOpen;
    applyStoreOpenState(settings.isOpen);

    if (!settings.isOpen) {
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

  if (isDelivery() && !getAddress()) {
    checkoutMessage.textContent = 'Informe seu endereço de entrega para finalizar o pedido.';
    checkoutMessage.style.color = '#d71920';
    openAddressModal();
    return;
  }

  const formData = new FormData(checkoutForm);
  const customerName = formData.get('name')?.toString().trim();
  const session = getSession();
  const paymentMethod = formData.get('payment')?.toString() || 'pix';
  // Só identificadores: quem define preço é o servidor (backend/pricing.js).
  const orderItems = state.cart.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    size: item.size,
    dough: item.dough,
    extras: item.extraIds,
  }));

  const payload = {
    customerName,
    customerPhone: formData.get('phone')?.toString().trim() || null,
    customerLogin: session.user?.username || null,
    deliveryLocation: resolveDeliveryLocation(formData.get('address')?.toString().trim()),
    notes: formData.get('notes')?.toString().trim() || null,
    orderMode: getOrderMode(),
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
      pixOrderId.textContent = data.order.order_code || data.order.id;
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
    const code = data.order.order_code || data.order.id;
    const retirada = getOrderMode() !== 'delivery';
    checkoutMessage.textContent = retirada
      ? `Pedido confirmado! Seu código de retirada é ${code} — informe no balcão.`
      : `Pedido confirmado para ${customerName || 'cliente'}! Código do pedido: ${code}.`;
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

modeOptions.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    setOrderMode(mode);
    applyOrderModeUI();

    if (mode === 'delivery' && !getAddress()) {
      openAddressModal();
    }
  });
});

locationButton.addEventListener('click', () => {
  if (isDelivery()) {
    openAddressModal();
    return;
  }
  document.getElementById('local')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

addressModalClose.addEventListener('click', closeAddressModal);

addressModal.addEventListener('click', (event) => {
  if (event.target === addressModal) {
    closeAddressModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !addressModal.classList.contains('hidden')) {
    closeAddressModal();
  }
});

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const street = addressStreet.value.trim();
  const neighborhood = addressNeighborhood.value.trim();

  if (!street || !neighborhood) {
    addressMessage.textContent = 'Preencha o endereço e o bairro para continuar.';
    addressMessage.style.color = '#d71920';
    return;
  }

  setAddress({ street, neighborhood, complement: addressComplement.value.trim() });
  setOrderMode('delivery');
  closeAddressModal();
  applyOrderModeUI();
  checkoutMessage.textContent = '';
  menuFilters.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

gateAddressButton.addEventListener('click', openAddressModal);

gatePickupButton.addEventListener('click', () => {
  setOrderMode('retirada');
  applyOrderModeUI();
  menuFilters.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelectorAll('[data-nav]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = link.dataset.nav;

    if ((target === 'cardapio' || target === 'cupons') && !isMenuUnlocked()) {
      event.preventDefault();
      openAddressModal();
    }
  });
});

if (loginButton) {
  loginButton.addEventListener('click', () => {
    openSidebar();
    sidebarUsername.focus();
  });
}

if (registerButton) {
  registerButton.addEventListener('click', () => {
    openSidebar();
    sidebarUsername.focus();
    sidebarLoginMessage.textContent = 'Preencha usuário e senha e toque em "Cadastrar cliente".';
  });
}

if (accountButton) {
  accountButton.addEventListener('click', openSidebar);
}

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
updateSidebarAccess();
if (session.token) {
  renderClientDashboard('history');
}

applyOrderModeUI();
loadStoreSettings();
initMenu();
loadSiteQrCode();
