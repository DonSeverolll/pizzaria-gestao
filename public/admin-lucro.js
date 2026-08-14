const summaryRevenue = document.getElementById('summaryRevenue');
const summaryOrders = document.getElementById('summaryOrders');
const summaryTicket = document.getElementById('summaryTicket');
const summaryPeriod = document.getElementById('summaryPeriod');
const productsTable = document.getElementById('productsTable');
const customRange = document.getElementById('customRange');
const applyCustomRange = document.getElementById('applyCustomRange');
const rangeFrom = document.getElementById('rangeFrom');
const rangeTo = document.getElementById('rangeTo');
const exportCsvButton = document.getElementById('exportCsvButton');
const exportPdfButton = document.getElementById('exportPdfButton');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');

const periodLabels = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Mês atual',
  custom: 'Período personalizado',
};

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

let currentReport = null;
let currentPeriod = 'today';

async function apiFetch(path) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) {
    localStorage.removeItem('pizzaria-token');
    window.location.href = '/admin';
    throw new Error('Sessão expirada.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Erro inesperado.');
  }

  return data;
}

function formatCurrency(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function renderReport(report) {
  currentReport = report;
  summaryRevenue.textContent = formatCurrency(report.totalRevenue);
  summaryOrders.textContent = report.totalOrders;
  summaryTicket.textContent = formatCurrency(report.avgTicket);
  summaryPeriod.textContent = periodLabels[report.period] || report.period;

  productsTable.innerHTML = report.products.length
    ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd. vendida</th>
            <th>Receita</th>
            <th>% Participação</th>
            <th>Classe</th>
          </tr>
        </thead>
        <tbody>
          ${report.products
            .map(
              (product) => `
                <tr>
                  <td>${product.name}</td>
                  <td>${product.quantity}</td>
                  <td>${formatCurrency(product.revenue)}</td>
                  <td>${product.share.toFixed(1)}%</td>
                  <td><span class="abc-badge" data-class="${product.class}">${product.class}</span></td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : '<p class="muted-text">Nenhum pedido no período selecionado.</p>';
}

async function loadReport(period, from, to) {
  try {
    const params = new URLSearchParams({ period });
    if (period === 'custom' && from && to) {
      params.set('from', from);
      params.set('to', to);
    }

    const report = await apiFetch(`/api/reports/sales?${params.toString()}`);
    renderReport(report);
  } catch (error) {
    productsTable.innerHTML = `<p>${error.message}</p>`;
  }
}

document.querySelectorAll('[data-period]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-period]').forEach((item) => item.classList.remove('primary'));
    button.classList.add('primary');
    currentPeriod = button.dataset.period;

    const isCustom = currentPeriod === 'custom';
    customRange.classList.toggle('hidden', !isCustom);
    applyCustomRange.classList.toggle('hidden', !isCustom);

    if (!isCustom) {
      loadReport(currentPeriod);
    }
  });
});

if (applyCustomRange) {
  applyCustomRange.addEventListener('click', () => {
    if (!rangeFrom.value || !rangeTo.value) return;
    loadReport('custom', rangeFrom.value, rangeTo.value);
  });
}

if (exportCsvButton) {
  exportCsvButton.addEventListener('click', () => {
    if (!currentReport) return;

    const rows = [
      ['Produto', 'Quantidade vendida', 'Receita', '% Participação', 'Classe'],
      ...currentReport.products.map((product) => [
        product.name,
        product.quantity,
        product.revenue.toFixed(2),
        product.share.toFixed(1),
        product.class,
      ]),
    ];

    const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-${currentReport.period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

if (exportPdfButton) {
  exportPdfButton.addEventListener('click', () => {
    window.print();
  });
}

if (adminMenuToggle && adminSidebar) {
  adminMenuToggle.addEventListener('click', () => {
    const isOpen = adminSidebar.classList.toggle('open');
    adminMenuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

loadReport(currentPeriod);
