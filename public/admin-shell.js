// Barra lateral unica do painel. Antes cada pagina tinha sua propria copia do
// menu, o que ja causou listas divergentes entre telas. Aqui tambem escondemos
// as areas que o perfil do funcionario nao acessa (a regra de verdade continua
// no servidor, em backend/auth.js).
(function () {
  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin', area: null },
    { key: 'pedidos', label: 'Pedidos', href: '/admin-pedidos.html', area: 'pedidos' },
    { key: 'pdv', label: 'PDV / Balcão', href: '/admin-pdv.html', area: 'pdv' },
    { key: 'mesas', label: 'Mesas e Cadeiras', href: '/admin-mesas.html', area: 'mesas' },
    { key: 'produtos', label: 'Produtos', href: '/admin-produtos.html', area: 'produtos' },
    { key: 'estoque', label: 'Estoque', href: '/admin-estoque.html', area: 'estoque' },
    { key: 'crm', label: 'CRM / Clientes', href: '/admin-crm.html', area: 'crm' },
    { key: 'lucro', label: 'Dashboard de Lucro', href: '/admin-lucro.html', area: 'lucro' },
    { key: 'funcionarios', label: 'Funcionários', href: '/admin-funcionarios.html', area: 'owner' },
    { key: 'config', label: 'Configurações', href: '/admin-config.html', area: 'owner' },
  ];

  function canSee(item, user) {
    if (!item.area) return true;
    if (item.area === 'owner') return Boolean(user?.isOwner);
    const permissions = user?.permissions || [];
    return permissions.includes('*') || permissions.includes(item.area);
  }

  function render(sidebar, user) {
    const active = sidebar.dataset.active || '';
    const visible = NAV_ITEMS.filter((item) => canSee(item, user));

    sidebar.innerHTML = `
      <div class="admin-brand">
        <img class="brand-logo brand-logo-admin" src="/logo-pl-real.png" alt="Logo PL Pizza" />
        <div>
          <strong>PL Pizza</strong>
          <small>${user?.roleLabel || 'Admin'}</small>
        </div>
      </div>

      <nav class="admin-nav" aria-label="Menu administrativo">
        ${visible
          .map(
            (item) =>
              `<a href="${item.href}" class="admin-nav-item${item.key === active ? ' active' : ''}">${item.label}</a>`
          )
          .join('')}
      </nav>

      <button class="sidebar-theme-toggle" data-theme-toggle type="button">🌙 Tema escuro</button>
    `;

    if (window.PLTheme) {
      window.PLTheme.sync(window.PLTheme.current());
    }
  }

  async function init() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const token = localStorage.getItem('pizzaria-token');
    let user = null;

    if (token) {
      try {
        const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          user = (await response.json()).user;
        }
      } catch (error) {
        // Sem rede: mostra o menu completo; o servidor barra o que nao pode.
      }
    }

    render(sidebar, user);

    const toggle = document.getElementById('adminMenuToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
