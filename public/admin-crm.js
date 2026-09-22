const crmList = document.getElementById('crmList');
const crmSearch = document.getElementById('crmSearch');
const crmSegment = document.getElementById('crmSegment');
const crmHistory = document.getElementById('crmHistory');
const crmHistoryBody = document.getElementById('crmHistoryBody');
const crmHistoryTitle = document.getElementById('crmHistoryTitle');
const crmHistoryClose = document.getElementById('crmHistoryClose');

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

let customers = [];
let storePhone = '';

const SEGMENT_LABELS = {
  novo: 'Novo',
  recorrente: 'Recorrente',
  inativo: 'Inativo',
  'sem-pedido': 'Sem pedido',
};

const SEGMENT_PILL = {
  novo: 'reserved',
  recorrente: 'available',
  inativo: 'occupied',
  'sem-pedido': 'cleaning',
};

async function apiFetch(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });

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

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function whatsappLink(customer) {
  const digits = onlyDigits(customer.phone);
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const text = encodeURIComponent(`Olá, ${customer.name}! Aqui é da PL Pizza.`);
  return `https://wa.me/${withCountry}?text=${text}`;
}

function renderList() {
  const term = crmSearch.value.trim().toLowerCase();
  const segment = crmSegment.value;

  const filtered = customers.filter((customer) => {
    const matchesSegment = !segment || customer.segment === segment;
    const matchesTerm =
      !term ||
      String(customer.name || '').toLowerCase().includes(term) ||
      onlyDigits(customer.phone).includes(onlyDigits(term));
    return matchesSegment && matchesTerm;
  });

  crmList.innerHTML = filtered.length
    ? filtered
        .map((customer) => {
          const wa = whatsappLink(customer);
          return `
            <article class="table-card">
              <div class="row">
                <h3>${customer.name || 'Cliente'}</h3>
                <span class="table-status" data-status="${SEGMENT_PILL[customer.segment]}">${SEGMENT_LABELS[customer.segment]}</span>
              </div>
              <div class="capacity"><strong>Telefone:</strong> ${customer.phone || '—'}</div>
              <div class="capacity"><strong>Pedidos:</strong> ${customer.orders}</div>
              <div class="capacity"><strong>Total gasto:</strong> ${toCurrency(customer.totalSpent)}</div>
              <div class="capacity"><strong>Ticket médio:</strong> ${toCurrency(customer.ticket)}</div>
              <div class="capacity"><strong>Último pedido:</strong> ${
                customer.daysSinceLastOrder === null
                  ? 'nunca'
                  : customer.daysSinceLastOrder === 0
                    ? 'hoje'
                    : `há ${customer.daysSinceLastOrder} dia(s)`
              }</div>
              ${customer.lastAddress ? `<div class="capacity"><strong>Último endereço:</strong> ${customer.lastAddress}</div>` : ''}
              <div class="type-actions">
                <button class="inline-button primary" data-action="history" data-key="${customer.key}" type="button">Ver pedidos</button>
                ${wa ? `<a class="inline-button" href="${wa}" target="_blank" rel="noreferrer">WhatsApp</a>` : ''}
              </div>
            </article>
          `;
        })
        .join('')
    : '<p class="muted-text">Nenhum cliente encontrado com esse filtro.</p>';

  crmList.querySelectorAll('[data-action="history"]').forEach((button) => {
    button.addEventListener('click', () => showHistory(button.dataset.key));
  });
}

async function showHistory(key) {
  const customer = customers.find((entry) => entry.key === key);
  if (!customer) return;

  crmHistory.classList.remove('hidden');
  crmHistoryTitle.textContent = `Pedidos de ${customer.name || 'cliente'}`;
  crmHistoryBody.innerHTML = '<p class="muted-text">Carregando...</p>';
  crmHistory.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const params = customer.phone
      ? `phone=${encodeURIComponent(customer.phone)}`
      : `name=${encodeURIComponent(customer.name)}`;
    const orders = await apiFetch(`/api/crm/customers/history?${params}`);

    crmHistoryBody.innerHTML = orders.length
      ? `<table class="data-table">
          <thead>
            <tr><th>Código</th><th>Data</th><th>Itens</th><th>Pagamento</th><th>Status</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (order) => `
                  <tr>
                    <td>${order.order_code || `#${order.id}`}</td>
                    <td>${new Date(String(order.created_at).replace(' ', 'T')).toLocaleString('pt-BR')}</td>
                    <td>${order.items.map((item) => `${item.product_name} x${item.quantity}`).join(', ') || '—'}</td>
                    <td>${order.payment_method || '—'}</td>
                    <td>${order.status}</td>
                    <td>${toCurrency(order.total_value)}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>`
      : '<p class="muted-text">Nenhum pedido encontrado.</p>';
  } catch (error) {
    crmHistoryBody.innerHTML = `<p class="muted-text">${error.message}</p>`;
  }
}

async function loadCrm() {
  try {
    const [data, settings] = await Promise.all([
      apiFetch('/api/crm/customers'),
      fetch('/api/store/public-settings').then((r) => r.json()).catch(() => ({})),
    ]);

    customers = data.customers;
    storePhone = settings.phone || '';

    document.getElementById('crmTotal').textContent = data.resumo.total;
    document.getElementById('crmReceita').textContent = toCurrency(data.resumo.receita);
    document.getElementById('crmTicket').textContent = toCurrency(data.resumo.ticketMedio);
    document.getElementById('crmSegmentos').textContent = `${data.resumo.recorrentes} / ${data.resumo.inativos}`;

    renderList();
  } catch (error) {
    crmList.innerHTML = `<p class="muted-text">${error.message}</p>`;
  }
}

crmSearch.addEventListener('input', renderList);
crmSegment.addEventListener('change', renderList);
crmHistoryClose.addEventListener('click', () => crmHistory.classList.add('hidden'));

loadCrm();
