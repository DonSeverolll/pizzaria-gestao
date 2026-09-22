const pdvProducts = document.getElementById('pdvProducts');
const pdvCategories = document.getElementById('pdvCategories');
const pdvSearch = document.getElementById('pdvSearch');
const pdvCart = document.getElementById('pdvCart');
const pdvTotal = document.getElementById('pdvTotal');
const pdvForm = document.getElementById('pdvForm');
const pdvMessage = document.getElementById('pdvMessage');
const pdvClear = document.getElementById('pdvClear');
const pdvReceipt = document.getElementById('pdvReceipt');

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

const state = { products: [], category: '', search: '', cart: [] };

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    localStorage.removeItem('pizzaria-token');
    window.location.href = '/admin';
    throw new Error('Sessão expirada.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Erro inesperado.');
  }

  return data;
}

function toCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function renderCategories() {
  const categories = [...new Set(state.products.map((product) => product.category))];
  if (!state.category) state.category = categories[0] || '';

  pdvCategories.innerHTML = categories
    .map(
      (category) =>
        `<button class="category-tab${category === state.category ? ' active' : ''}" data-category="${category}" type="button">${category}</button>`
    )
    .join('');

  pdvCategories.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

function renderProducts() {
  const term = state.search.trim().toLowerCase();
  const visible = state.products.filter(
    (product) =>
      (term ? product.name.toLowerCase().includes(term) : product.category === state.category) &&
      Number(product.active ?? 1)
  );

  pdvProducts.innerHTML = visible.length
    ? visible
        .map(
          (product) => `
            <button class="pdv-product" data-id="${product.id}" type="button">
              <strong>${product.name}</strong>
              <span>${toCurrency(product.price)}</span>
            </button>
          `
        )
        .join('')
    : '<p class="muted-text">Nenhum produto encontrado.</p>';

  pdvProducts.querySelectorAll('[data-id]').forEach((button) => {
    button.addEventListener('click', () => addToCart(Number(button.dataset.id)));
  });
}

function addToCart(productId) {
  const product = state.products.find((entry) => entry.id === productId);
  if (!product) return;

  const existing = state.cart.find((entry) => entry.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId, name: product.name, price: Number(product.price), quantity: 1 });
  }

  renderCart();
}

function renderCart() {
  pdvCart.innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <div class="pdv-cart-item">
              <div>
                <strong>${item.name}</strong>
                <small>${toCurrency(item.price)} un.</small>
              </div>
              <div class="cart-controls">
                <button type="button" data-action="dec" data-id="${item.productId}">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-action="inc" data-id="${item.productId}">+</button>
              </div>
              <strong>${toCurrency(item.price * item.quantity)}</strong>
            </div>
          `
        )
        .join('')
    : '<p class="muted-text">Comanda vazia. Toque em um produto para adicionar.</p>';

  // Referencia visual: o valor cobrado e sempre recalculado no servidor.
  pdvTotal.textContent = toCurrency(state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));

  pdvCart.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const item = state.cart.find((entry) => entry.productId === id);
      if (!item) return;

      item.quantity += button.dataset.action === 'inc' ? 1 : -1;
      if (item.quantity <= 0) {
        state.cart = state.cart.filter((entry) => entry.productId !== id);
      }
      renderCart();
    });
  });
}

pdvForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  pdvMessage.textContent = '';
  pdvReceipt.classList.add('hidden');

  if (!state.cart.length) {
    pdvMessage.textContent = 'Adicione pelo menos um item à comanda.';
    pdvMessage.style.color = 'var(--danger)';
    return;
  }

  try {
    const data = await apiFetch('/api/pdv/sale', {
      method: 'POST',
      body: JSON.stringify({
        customerName: document.getElementById('pdvCustomer').value.trim() || null,
        paymentMethod: document.getElementById('pdvPayment').value,
        notes: document.getElementById('pdvNotes').value.trim() || null,
        items: state.cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    });

    pdvReceipt.innerHTML = `
      <strong class="pdv-receipt-code">${data.order.order_code}</strong>
      <span>Total cobrado: ${toCurrency(data.resumo.total)}</span>
      <span>${data.lancadoNoCaixa ? 'Lançado no caixa aberto.' : 'Caixa fechado — venda registrada sem lançamento.'}</span>
    `;
    pdvReceipt.classList.remove('hidden');

    state.cart = [];
    renderCart();
    pdvForm.reset();
    pdvMessage.textContent = 'Venda registrada.';
    pdvMessage.style.color = 'var(--success)';
  } catch (error) {
    pdvMessage.textContent = error.message;
    pdvMessage.style.color = 'var(--danger)';
  }
});

pdvClear.addEventListener('click', () => {
  state.cart = [];
  renderCart();
  pdvReceipt.classList.add('hidden');
  pdvMessage.textContent = '';
});

pdvSearch.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderProducts();
});

(async function init() {
  try {
    // Cardapio ativo: o atendente do balcao vende o que esta disponivel, e nao
    // precisa da permissao de edicao de produtos para isso.
    state.products = await apiFetch('/api/menu');
    renderCategories();
    renderProducts();
    renderCart();
  } catch (error) {
    pdvProducts.innerHTML = `<p class="muted-text">${error.message}</p>`;
  }
})();
