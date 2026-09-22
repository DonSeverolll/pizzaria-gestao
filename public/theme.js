// Tema claro/escuro compartilhado entre a vitrine e o painel.
// Carregado no <head> sem defer para o tema ja valer na primeira pintura.
(function () {
  const STORAGE_KEY = 'pl-pizzas-theme';

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch (error) {
      // localStorage bloqueado (janela anonima): segue pela preferencia do sistema.
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncToggles(theme) {
    document.querySelectorAll('[data-theme-toggle], #themeToggle').forEach((button) => {
      button.textContent = theme === 'dark' ? '☀ Tema claro' : '🌙 Tema escuro';
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // Sem persistencia: o tema ainda vale para esta navegacao.
    }
    syncToggles(theme);
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  applyTheme(preferredTheme());

  document.addEventListener('DOMContentLoaded', () => syncToggles(currentTheme()));

  // Delegado: funciona tambem para botoes criados depois (barra lateral do painel).
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-theme-toggle], #themeToggle')) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  window.PLTheme = { apply: applyTheme, current: currentTheme, sync: syncToggles };
})();
