// Barra lateral unica do painel. Antes cada pagina tinha sua propria copia do
// menu, o que ja causou listas divergentes entre telas. Aqui tambem escondemos
// as areas que o perfil do funcionario nao acessa (a regra de verdade continua
// no servidor, em backend/auth.js).
// Depende de /js/core.js (window.PL). Este arquivo e carregado com defer no
// <head>, entao so roda depois dos scripts do fim do <body>, inclusive core.js.
(function () {
  // Icones de traco (24x24) de cada area do painel.
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    pedidos: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    pdv: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4M8 15h2M14 15h2"/>',
    mesas: '<path d="M4 9h16M6 9v11M18 9v11M3 9l2-5h14l2 5"/>',
    produtos: '<path d="M12 21 3.5 6.5a17 17 0 0 1 17 0z"/><circle cx="10" cy="10" r="1.3"/><circle cx="14" cy="13" r="1.3"/>',
    estoque: '<path d="M3 7 12 3l9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    crm: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    lucro: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    funcionarios: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M8 17a4 4 0 0 1 8 0"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };

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

  // Ate esta largura a barra lateral vira gaveta (comeca fechada).
  const DRAWER_BREAKPOINT = 980;

  function icon(key) {
    return `<svg class="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[key] || ''}</svg>`;
  }

  function canSee(item, user) {
    if (!item.area) return true;
    if (item.area === 'owner') return Boolean(user?.isOwner);
    const permissions = user?.permissions || [];
    return permissions.includes('*') || permissions.includes(item.area);
  }

  // Iniciais do nome de exibicao ("Alejandro Lima" -> "AL"); sem nome, as duas
  // primeiras letras do login.
  function initials(user) {
    const words = String(user?.name || user?.username || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function displayName(user) {
    return user?.name || user?.username || '';
  }

  function avatar(user) {
    return `<span class="admin-avatar" aria-hidden="true">${window.PL.dom.escapeHtml(initials(user))}</span>`;
  }

  // Cartao de quem esta logado, no canto de baixo da barra lateral.
  function userCard(user) {
    if (!user) return '';
    const escape = window.PL.dom.escapeHtml;
    return `
      <div class="admin-user-card" title="${escape(displayName(user))} · ${escape(user.roleLabel || '')}">
        ${avatar(user)}
        <div class="admin-user-card__text">
          <strong>${escape(displayName(user))}</strong>
          <small>${escape(user.username)}${user.roleLabel ? ` · ${escape(user.roleLabel)}` : ''}</small>
        </div>
      </div>
    `;
  }

  // Icone com o nome no canto superior direito do cabecalho da pagina. O que ja
  // estava a direita do titulo (Sair, Voltar...) vai para a mesma barra.
  function renderHeaderChip(user) {
    document.querySelectorAll('.admin-user-chip').forEach((chip) => chip.remove());
    if (!user) return;

    const header = document.querySelector('.admin-content header.admin-header');
    if (!header) return;

    let toolbar = header.querySelector(':scope > .admin-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'admin-toolbar';
      [...header.children].slice(1).forEach((child) => toolbar.appendChild(child));
      header.appendChild(toolbar);
    }

    const escape = window.PL.dom.escapeHtml;
    const chip = document.createElement('div');
    chip.className = 'admin-user-chip';
    chip.title = `${displayName(user)} · ${user.roleLabel || ''}`;
    chip.innerHTML = `
      ${avatar(user)}
      <span class="admin-user-chip__text">
        <strong>${escape(displayName(user))}</strong>
        <small>${escape(user.roleLabel || '')}</small>
      </span>
    `;
    toolbar.appendChild(chip);
  }

  async function fetchUser() {
    const token = window.PL.auth.getToken();
    if (!token) return null;
    // Fetch direto (e nao PL.api): aqui um 401 nao deve redirecionar; sem
    // usuario, o menu completo aparece e o servidor barra o que nao pode.
    try {
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      return response.ok ? (await response.json()).user : null;
    } catch (error) {
      // Sem rede: mostra o menu completo; o servidor barra o que nao pode.
      return null;
    }
  }

  function render(sidebar, user) {
    const active = sidebar.dataset.active || '';
    const visible = NAV_ITEMS.filter((item) => canSee(item, user));

    sidebar.innerHTML = `
      <div class="admin-brand">
        <img class="brand-logo brand-logo-admin" src="/logo-pl-real.png" alt="Logo PL Pizza" />
        <div>
          <strong>PL Pizza</strong>
          <small>${window.PL.dom.escapeHtml(user?.roleLabel || 'Admin')}</small>
        </div>
      </div>

      <nav class="admin-nav" aria-label="Menu administrativo">
        ${visible
          .map(
            (item) =>
              `<a href="${item.href}" class="admin-nav-item${item.key === active ? ' active' : ''}"${item.key === active ? ' aria-current="page"' : ''}>${icon(item.key)}<span>${item.label}</span></a>`
          )
          .join('')}
      </nav>

      ${userCard(user)}

      <div class="admin-sidebar-footer">
        <span>Tema</span>
        <button class="theme-switch" data-theme-toggle type="button" aria-label="Alternar tema claro/escuro"></button>
      </div>
    `;

    if (window.PLTheme) {
      window.PLTheme.enhance(sidebar);
    }

    renderHeaderChip(user);
  }

  // Remonta menu, cartao e icone (ex.: logo depois do login ou do "Sair" no
  // admin.html, que troca de tela sem recarregar a pagina).
  async function refresh() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;
    render(sidebar, await fetchUser());
  }

  window.PLAdminShell = { refresh };

  async function init() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const toggle = document.getElementById('adminMenuToggle');

    // No celular/tablet a barra comeca fechada para nao cobrir o conteudo.
    if (window.innerWidth <= DRAWER_BREAKPOINT) {
      sidebar.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    }
    sidebar.dataset.ready = 'true';

    render(sidebar, await fetchUser());

    if (toggle) {
      toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    // Gaveta aberta no celular: tocar fora dela fecha.
    document.addEventListener('click', (event) => {
      if (window.innerWidth > DRAWER_BREAKPOINT || !sidebar.classList.contains('open')) return;
      if (sidebar.contains(event.target) || toggle?.contains(event.target)) return;
      sidebar.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
