const productForm = document.getElementById('productForm');
const productsList = document.getElementById('productsList');
const productMessage = document.getElementById('productMessage');
const productIdInput = document.getElementById('productId');
const productSubmitButton = document.getElementById('productSubmitButton');
const productCancelEdit = document.getElementById('productCancelEdit');
const productCategory = document.getElementById('productCategory');
const foodFields = document.getElementById('foodFields');
const drinkFields = document.getElementById('drinkFields');
const productImageInput = document.getElementById('productImage');
const productImageFile = document.getElementById('productImageFile');
const uploadImageButton = document.getElementById('uploadImageButton');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminSidebar = document.getElementById('adminSidebar');

const token = localStorage.getItem('pizzaria-token');
if (!token) {
  window.location.href = '/admin';
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('pizzaria-token');
    window.location.href = '/admin';
    throw new Error('Sessão expirada.');
  }

  if (res.status === 204) {
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Erro inesperado.');
  }

  return data;
}

function updateCategoryFields() {
  const category = productCategory.value;
  const isFood = category === 'Comida' || category === 'Pizza';
  const isDrink = category === 'Bebida';

  foodFields.classList.toggle('hidden', !isFood);
  drinkFields.classList.toggle('hidden', !isDrink);
}

function parseSizePrices(product) {
  if (!product.size_prices) return {};
  try {
    return JSON.parse(product.size_prices);
  } catch (error) {
    return {};
  }
}

function resetForm() {
  productForm.reset();
  productIdInput.value = '';
  productSubmitButton.textContent = 'Adicionar produto';
  productCancelEdit.classList.add('hidden');
  updateCategoryFields();
}

function fillFormForEdit(product) {
  productIdInput.value = product.id;
  document.getElementById('productName').value = product.name || '';

  const hasMatchingOption = Array.from(productCategory.options).some((option) => option.value === product.category);
  if (product.category && !hasMatchingOption) {
    const customOption = document.createElement('option');
    customOption.value = product.category;
    customOption.textContent = product.category;
    productCategory.appendChild(customOption);
  }
  productCategory.value = product.category || '';
  document.getElementById('productPrice').value = product.price ?? '';
  productImageInput.value = product.image || '';
  document.getElementById('productDescription').value = product.description || '';
  document.getElementById('productFlavors').value = product.flavors || '';
  document.getElementById('productSizes').value = product.sizes || '';
  document.getElementById('productDoughType').value = product.dough_type || '';
  document.getElementById('productMeasure').value = product.measure || '';

  const sizePrices = parseSizePrices(product);
  document.getElementById('priceBroto').value = sizePrices.broto ?? '';
  document.getElementById('priceMedia').value = sizePrices.media ?? '';
  document.getElementById('priceGrande').value = sizePrices.grande ?? '';
  document.getElementById('priceGigante').value = sizePrices.gigante ?? '';

  updateCategoryFields();
  productSubmitButton.textContent = 'Salvar alterações';
  productCancelEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderProducts(products) {
  productsList.innerHTML = products.length
    ? products
        .map((product) => {
          const isActive = Boolean(Number(product.active ?? 1));
          return `
            <article class="table-card">
              <div class="row">
                <h3>${product.name}</h3>
                <span class="table-status" data-status="${isActive ? 'available' : 'occupied'}">${isActive ? 'Disponível' : 'Esgotado'}</span>
              </div>
              <div class="capacity"><strong>Categoria:</strong> ${product.category}</div>
              <div class="capacity"><strong>Descrição:</strong> ${product.description || 'Sem descrição'}</div>
              <div class="capacity"><strong>Valor base:</strong> R$ ${Number(product.price || 0).toFixed(2)}</div>
              <div class="capacity"><strong>Sabores:</strong> ${product.flavors || '—'}</div>
              <div class="capacity"><strong>Tamanhos:</strong> ${product.sizes || '—'}</div>
              <div class="type-actions">
                <button class="inline-button primary" data-action="edit" data-id="${product.id}" type="button">Editar</button>
                <button class="inline-button" data-action="toggle" data-id="${product.id}" data-active="${isActive}" type="button">${isActive ? 'Marcar esgotado' : 'Marcar disponível'}</button>
                <button class="inline-button" data-action="delete" data-id="${product.id}" type="button">Excluir</button>
              </div>
            </article>
          `;
        })
        .join('')
    : '<p class="muted-text">Nenhum produto cadastrado.</p>';

  productsList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const { action, id } = button.dataset;
      const product = products.find((item) => String(item.id) === id);
      if (!product) return;

      if (action === 'edit') {
        fillFormForEdit(product);
        return;
      }

      if (action === 'toggle') {
        const nextActive = button.dataset.active !== 'true';
        try {
          await apiFetch(`/api/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ active: nextActive }),
          });
          await loadProducts();
        } catch (error) {
          productMessage.textContent = error.message;
        }
        return;
      }

      if (action === 'delete') {
        if (!confirm(`Excluir "${product.name}" permanentemente?`)) return;
        try {
          await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
          await loadProducts();
        } catch (error) {
          productMessage.textContent = error.message;
        }
      }
    });
  });
}

async function loadProducts() {
  try {
    const products = await apiFetch('/api/products');
    renderProducts(products);
  } catch (error) {
    productsList.innerHTML = `<p>${error.message}</p>`;
  }
}

function buildSizePrices() {
  const sizePrices = {
    broto: document.getElementById('priceBroto').value,
    media: document.getElementById('priceMedia').value,
    grande: document.getElementById('priceGrande').value,
    gigante: document.getElementById('priceGigante').value,
  };

  const hasAny = Object.values(sizePrices).some((value) => value !== '');
  if (!hasAny) return undefined;

  return Object.fromEntries(
    Object.entries(sizePrices)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, Number(value)])
  );
}

if (uploadImageButton) {
  uploadImageButton.addEventListener('click', async () => {
    const file = productImageFile.files[0];
    if (!file) {
      productMessage.textContent = 'Escolha um arquivo de imagem antes de enviar.';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      uploadImageButton.disabled = true;
      uploadImageButton.textContent = 'Enviando...';
      const result = await apiFetch('/api/uploads/image', { method: 'POST', body: formData });
      productImageInput.value = result.url;
      productMessage.textContent = 'Imagem enviada com sucesso.';
    } catch (error) {
      productMessage.textContent = error.message;
    } finally {
      uploadImageButton.disabled = false;
      uploadImageButton.textContent = 'Enviar imagem';
    }
  });
}

if (productCategory) {
  productCategory.addEventListener('change', updateCategoryFields);
}

if (productCancelEdit) {
  productCancelEdit.addEventListener('click', resetForm);
}

if (productForm) {
  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    productMessage.textContent = '';

    const payload = {
      name: document.getElementById('productName').value.trim(),
      category: productCategory.value,
      price: Number(document.getElementById('productPrice').value),
      image: productImageInput.value.trim(),
      description: document.getElementById('productDescription').value.trim(),
      flavors: document.getElementById('productFlavors').value.trim(),
      sizes: document.getElementById('productSizes').value.trim(),
      doughType: document.getElementById('productDoughType').value.trim(),
      measure: document.getElementById('productMeasure').value.trim(),
      sizePrices: buildSizePrices(),
    };

    const id = productIdInput.value;

    try {
      if (id) {
        await apiFetch(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        productMessage.textContent = 'Produto atualizado com sucesso.';
      } else {
        await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) });
        productMessage.textContent = 'Produto cadastrado com sucesso.';
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      productMessage.textContent = error.message;
    }
  });
}

if (adminMenuToggle && adminSidebar) {
  adminMenuToggle.addEventListener('click', () => {
    const isOpen = adminSidebar.classList.toggle('open');
    adminMenuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

updateCategoryFields();
loadProducts();
