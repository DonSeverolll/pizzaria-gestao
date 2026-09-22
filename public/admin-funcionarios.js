const staffForm = document.getElementById('staffForm');
const staffList = document.getElementById('staffList');
const staffMessage = document.getElementById('staffMessage');

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

let currentUserId = null;

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

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Erro inesperado.');
  }

  return data;
}

function showMessage(text, isError = false) {
  staffMessage.textContent = text;
  staffMessage.style.color = isError ? 'var(--danger)' : 'var(--success)';
}

function renderStaff(users, roles) {
  staffList.innerHTML = users.length
    ? users
        .map((user) => {
          const isSelf = user.id === currentUserId;
          return `
            <article class="table-card">
              <div class="row">
                <h3>${user.name || user.username}</h3>
                <span class="table-status" data-status="${user.role === 'dono' || user.role === 'admin' ? 'available' : 'cleaning'}">${roles[user.role] || user.role}</span>
              </div>
              <div class="capacity"><strong>Usuário:</strong> ${user.username}${isSelf ? ' (você)' : ''}</div>
              <div class="capacity"><strong>Desde:</strong> ${
                user.created_at ? new Date(String(user.created_at).replace(' ', 'T')).toLocaleDateString('pt-BR') : '—'
              }</div>

              <div class="option-group" style="margin-top: 12px;">
                <label>
                  <span>Perfil</span>
                  <select data-action="role" data-id="${user.id}">
                    ${['dono', 'gerente', 'caixa', 'cozinha']
                      .map(
                        (role) =>
                          `<option value="${role}"${role === user.role || (role === 'dono' && user.role === 'admin') ? ' selected' : ''}>${roles[role] || role}</option>`
                      )
                      .join('')}
                  </select>
                </label>
              </div>

              <div class="type-actions">
                <button class="inline-button" data-action="password" data-id="${user.id}" type="button">Trocar senha</button>
                <button class="inline-button" data-action="remove" data-id="${user.id}" data-name="${user.name || user.username}" type="button" ${isSelf ? 'disabled' : ''}>Remover</button>
              </div>
            </article>
          `;
        })
        .join('')
    : '<p class="muted-text">Nenhum funcionário cadastrado.</p>';

  staffList.querySelectorAll('[data-action="role"]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await apiFetch(`/api/admin/users/${select.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ role: select.value }),
        });
        showMessage('Perfil atualizado.');
        await loadStaff();
      } catch (error) {
        showMessage(error.message, true);
        await loadStaff();
      }
    });
  });

  staffList.querySelectorAll('[data-action="password"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const password = prompt('Nova senha (mínimo 6 caracteres):');
      if (!password) return;

      try {
        await apiFetch(`/api/admin/users/${button.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ password }),
        });
        showMessage('Senha alterada.');
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });

  staffList.querySelectorAll('[data-action="remove"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm(`Remover "${button.dataset.name}" da equipe?`)) return;

      try {
        await apiFetch(`/api/admin/users/${button.dataset.id}`, { method: 'DELETE' });
        showMessage('Funcionário removido.');
        await loadStaff();
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function loadStaff() {
  try {
    const me = await apiFetch('/api/auth/me');
    currentUserId = me.user.id;

    const data = await apiFetch('/api/admin/users');
    renderStaff(data.users, data.roles);
  } catch (error) {
    staffList.innerHTML = `<p class="muted-text">${error.message}</p>`;
  }
}

staffForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');

  try {
    await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('staffName').value.trim(),
        username: document.getElementById('staffUsername').value.trim(),
        password: document.getElementById('staffPassword').value,
        role: document.getElementById('staffRole').value,
      }),
    });

    staffForm.reset();
    showMessage('Funcionário adicionado.');
    await loadStaff();
  } catch (error) {
    showMessage(error.message, true);
  }
});

loadStaff();
