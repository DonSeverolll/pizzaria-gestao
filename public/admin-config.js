const settingsForm = document.getElementById('storeSettingsForm');
const hoursForm = document.getElementById('storeHoursForm');
const cashRegisterForm = document.getElementById('cashRegisterForm');
const cashMovementForm = document.getElementById('cashMovementForm');
const storeMessage = document.getElementById('storeMessage');
const cashMessage = document.getElementById('cashMessage');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');
const logoFile = document.getElementById('logoFile');
const uploadLogoButton = document.getElementById('uploadLogoButton');
const logoPreview = document.getElementById('logoPreview');

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erro ao salvar configuração.');
  }

  return res.json();
}

async function loadSettings() {
  const data = await apiFetch('/api/store/settings');
  settingsForm.companyName.value = data.company_name || 'PL Pizza';
  settingsForm.logoUrl.value = data.logo_url || '/logo-pl-real.png';
  settingsForm.phone.value = data.phone || '';
  settingsForm.address.value = data.address || '';
  settingsForm.pixKey.value = data.pix_key || '';
  settingsForm.pixOwnerName.value = data.pix_owner_name || '';
  settingsForm.pixCity.value = data.pix_city || '';
  settingsForm.isOpen.checked = Boolean(Number(data.is_open ?? 1));
  settingsForm.deliveryFee.value = data.delivery_fee ?? 9.9;
  settingsForm.deliveryRule.value = data.delivery_rule || 'fixed';
  showLogoPreview(settingsForm.logoUrl.value);
}

function showLogoPreview(url) {
  if (!logoPreview) return;
  if (url) {
    logoPreview.src = url;
    logoPreview.classList.remove('hidden');
  } else {
    logoPreview.classList.add('hidden');
  }
}

async function loadHours() {
  const rows = await apiFetch('/api/store/hours');
  const dayMap = new Map(rows.map((entry) => [Number(entry.day_of_week), entry]));

  ['0', '1', '2', '3', '4', '5', '6'].forEach((value) => {
    const row = dayMap.get(Number(value));
    const entry = document.querySelector(`[data-day="${value}"]`);
    if (!entry) return;
    const enabled = entry.querySelector('[name="enabled"]');
    const openTime = entry.querySelector('[name="openTime"]');
    const closeTime = entry.querySelector('[name="closeTime"]');

    enabled.checked = row ? Boolean(Number(row.enabled)) : true;
    openTime.value = row?.open_time || '18:00';
    closeTime.value = row?.close_time || '23:00';
  });
}

async function loadCashRegister() {
  const cash = await apiFetch('/api/cash/register');
  const summary = document.getElementById('cashSummary');
  if (summary) {
    summary.innerHTML = `
      <div><strong>Status:</strong> ${cash.status || 'closed'}</div>
      <div><strong>Dinheiro:</strong> R$ ${Number(cash.cash_total || 0).toFixed(2)}</div>
      <div><strong>Pix:</strong> R$ ${Number(cash.pix_total || 0).toFixed(2)}</div>
      <div><strong>Cartão:</strong> R$ ${Number(cash.card_total || 0).toFixed(2)}</div>
      <div><strong>Saídas:</strong> R$ ${Number(cash.withdrawals || 0).toFixed(2)}</div>
    `;
  }

  const movementList = document.getElementById('movementList');
  if (movementList && Array.isArray(cash.movements)) {
    movementList.innerHTML = cash.movements.length
      ? cash.movements.map((movement) => `
          <div class="movement-item">
            <span>${movement.type}</span>
            <strong>R$ ${Number(movement.amount || 0).toFixed(2)}</strong>
            <small>${movement.method || 'dinheiro'} · ${movement.description || 'Sem descrição'}</small>
          </div>
        `).join('')
      : '<p class="muted-text">Nenhum movimento registrado.</p>';
  }
}

if (settingsForm) {
  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await apiFetch('/api/store/settings', {
        method: 'POST',
        body: JSON.stringify({
          companyName: settingsForm.companyName.value,
          logoUrl: settingsForm.logoUrl.value,
          phone: settingsForm.phone.value,
          address: settingsForm.address.value,
          pixKey: settingsForm.pixKey.value,
          pixOwnerName: settingsForm.pixOwnerName.value,
          pixCity: settingsForm.pixCity.value,
          isOpen: settingsForm.isOpen.checked,
          deliveryFee: Number(settingsForm.deliveryFee.value || 0),
          deliveryRule: settingsForm.deliveryRule.value,
        }),
      });
      storeMessage.textContent = 'Configurações da loja atualizadas com sucesso.';
    } catch (error) {
      storeMessage.textContent = error.message;
    }
  });
}

if (hoursForm) {
  hoursForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rows = Array.from(document.querySelectorAll('[data-day]')).map((container) => ({
      dayOfWeek: Number(container.dataset.day),
      enabled: container.querySelector('[name="enabled"]').checked,
      openTime: container.querySelector('[name="openTime"]').value,
      closeTime: container.querySelector('[name="closeTime"]').value,
    }));

    try {
      await apiFetch('/api/store/hours', {
        method: 'POST',
        body: JSON.stringify(rows),
      });
      storeMessage.textContent = 'Horários de funcionamento atualizados.';
    } catch (error) {
      storeMessage.textContent = error.message;
    }
  });
}

if (cashRegisterForm) {
  cashRegisterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = {
        initialBalance: Number(cashRegisterForm.initialBalance.value || 0),
        openedBy: cashRegisterForm.openedBy.value || 'admin',
        notes: cashRegisterForm.notes.value || '',
      };

      await apiFetch('/api/cash/register/open', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      cashMessage.textContent = 'Caixa aberto com sucesso.';
      await loadCashRegister();
    } catch (error) {
      cashMessage.textContent = error.message;
    }
  });
}

if (cashMovementForm) {
  cashMovementForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = {
        registerId: Number(cashMovementForm.registerId.value),
        type: cashMovementForm.type.value,
        amount: Number(cashMovementForm.amount.value || 0),
        method: cashMovementForm.method.value,
        description: cashMovementForm.description.value,
      };

      await apiFetch('/api/cash/register/movement', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      cashMessage.textContent = 'Movimento registrado.';
      await loadCashRegister();
      cashMovementForm.reset();
    } catch (error) {
      cashMessage.textContent = error.message;
    }
  });
}

if (uploadLogoButton) {
  uploadLogoButton.addEventListener('click', async () => {
    const file = logoFile.files[0];
    if (!file) {
      storeMessage.textContent = 'Escolha um arquivo de imagem antes de enviar.';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      uploadLogoButton.disabled = true;
      uploadLogoButton.textContent = 'Enviando...';

      // FormData define o proprio Content-Type (com boundary), por isso nao usa apiFetch.
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao enviar a logo.');
      }

      settingsForm.logoUrl.value = data.url;
      showLogoPreview(data.url);
      storeMessage.textContent = 'Logo enviada! Clique em "Salvar configurações" para aplicar no site.';
    } catch (error) {
      storeMessage.textContent = error.message;
    } finally {
      uploadLogoButton.disabled = false;
      uploadLogoButton.textContent = 'Enviar logo';
    }
  });
}

if (adminMenuToggle && adminSidebar) {
  adminMenuToggle.addEventListener('click', () => {
    const isOpen = adminSidebar.classList.toggle('open');
    adminMenuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

loadSettings();
loadHours();
loadCashRegister();
