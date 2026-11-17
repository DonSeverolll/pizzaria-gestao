const inventoryForm = document.getElementById('inventoryForm');
const inventoryMessage = document.getElementById('inventoryMessage');
const inventoryGrid = document.getElementById('inventoryGrid');
const movementForm = document.getElementById('movementForm');
const movementIngredient = document.getElementById('movementIngredient');
const movementList = document.getElementById('movementList');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');

// Helpers compartilhados (js/core.js).
const { escapeHtml } = PL.dom;

const token = PL.auth.requireToken();
const apiFetch = PL.api.client({ token });

let inventoryItems = [];

function renderInventory() {
  inventoryGrid.innerHTML = inventoryItems.length
    ? inventoryItems
        .map((item) => {
          const isLow = Number(item.quantity) < Number(item.minimum_quantity);
          return `
            <div class="stock-item ${isLow ? 'low-stock' : ''}">
              <strong>${escapeHtml(item.ingredient_name)}</strong>
              <span>${Number(item.quantity).toFixed(2)} ${escapeHtml(item.unit)}</span>
              <span class="muted-text">Mínimo: ${Number(item.minimum_quantity).toFixed(2)} ${escapeHtml(item.unit)}</span>
              <button class="inline-button" data-id="${escapeHtml(item.id)}" type="button">Excluir</button>
            </div>
          `;
        })
        .join('')
    : '<p class="muted-text">Nenhum ingrediente cadastrado.</p>';

  inventoryGrid.querySelectorAll('[data-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = inventoryItems.find((entry) => String(entry.id) === button.dataset.id);
      if (!item) return;
      if (!confirm(`Excluir "${item.ingredient_name}" do estoque?`)) return;

      try {
        await apiFetch(`/api/inventory/${item.id}`, { method: 'DELETE' });
        await loadInventory();
      } catch (error) {
        inventoryMessage.textContent = error.message;
      }
    });
  });
}

function renderMovementIngredientOptions() {
  const previousValue = movementIngredient.value;
  movementIngredient.innerHTML = inventoryItems
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.ingredient_name)}</option>`)
    .join('');

  if (previousValue && inventoryItems.some((item) => String(item.id) === previousValue)) {
    movementIngredient.value = previousValue;
  }
}

async function loadMovements() {
  const id = movementIngredient.value;
  if (!id) {
    movementList.innerHTML = '';
    return;
  }

  try {
    const movements = await apiFetch(`/api/inventory/${id}/movements`);
    movementList.innerHTML = movements.length
      ? movements
          .map(
            (movement) => `
              <div class="movement-item">
                <span>${escapeHtml(movement.movement_type)}</span>
                <strong>${Number(movement.quantity).toFixed(2)}</strong>
                <small>${escapeHtml(new Date(movement.created_at).toLocaleString('pt-BR'))} · ${escapeHtml(movement.notes || 'Sem observação')}</small>
              </div>
            `
          )
          .join('')
      : '<p class="muted-text">Nenhum movimento registrado para este ingrediente.</p>';
  } catch (error) {
    movementList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function loadInventory() {
  try {
    inventoryItems = await apiFetch('/api/inventory');
    renderInventory();
    renderMovementIngredientOptions();
    await loadMovements();
  } catch (error) {
    inventoryGrid.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

if (inventoryForm) {
  inventoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    inventoryMessage.textContent = '';

    const payload = {
      ingredientName: document.getElementById('ingredientName').value.trim(),
      unit: document.getElementById('ingredientUnit').value.trim(),
      quantity: Number(document.getElementById('ingredientQuantity').value || 0),
      minimumQuantity: Number(document.getElementById('ingredientMinimum').value || 0),
    };

    try {
      await apiFetch('/api/inventory', { method: 'POST', body: JSON.stringify(payload) });
      inventoryForm.reset();
      inventoryMessage.textContent = 'Ingrediente cadastrado com sucesso.';
      await loadInventory();
    } catch (error) {
      inventoryMessage.textContent = error.message;
    }
  });
}

if (movementForm) {
  movementForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = movementIngredient.value;
    if (!id) return;

    const payload = {
      movementType: document.getElementById('movementType').value,
      quantity: Number(document.getElementById('movementQuantity').value || 0),
      notes: document.getElementById('movementNotes').value.trim(),
    };

    try {
      await apiFetch(`/api/inventory/${id}/movement`, { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('movementQuantity').value = '';
      document.getElementById('movementNotes').value = '';
      await loadInventory();
    } catch (error) {
      inventoryMessage.textContent = error.message;
    }
  });
}

if (movementIngredient) {
  movementIngredient.addEventListener('change', loadMovements);
}

loadInventory();
