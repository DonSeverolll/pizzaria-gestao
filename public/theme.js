// Tema claro/escuro compartilhado entre a vitrine e o painel.
// Carregado no <head> sem defer para o tema ja valer na primeira pintura.
//
// Botoes com a classe "theme-switch" e o atributo data-theme-toggle viram a
// chave animada (quadrado arredondado que desliza, com sol e lua em pixel
// art). Botoes antigos sem essa classe continuam como texto.
(function () {
  const STORAGE_KEY = 'pl-pizzas-theme';

  // Desenhos em pixel (11x11). "#" vira um ponto da matriz.
  const SUN = [
    '.....#.....',
    '.#.......#.',
    '...........',
    '....###....',
    '...#####...',
    '#..#####..#',
    '...#####...',
    '....###....',
    '...........',
    '.#.......#.',
    '.....#.....',
  ];

  // Lua crescente cheia, com uma estrela e um brilho no recorte.
  const MOON = [
    '.........#.',
    '..###...###',
    '.###.....#.',
    '.###.......',
    '####...#...',
    '#####......',
    '#####......',
    '.######....',
    '.########..',
    '..#######..',
    '....###....',
  ];

  function pixelIcon(rows, className) {
    let dots = '';
    rows.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === '#') {
          dots += `<rect x="${x + 0.12}" y="${y + 0.12}" width="0.76" height="0.76" rx="0.2"/>`;
        }
      });
    });
    return `<svg class="${className}" viewBox="0 0 11 11" aria-hidden="true" focusable="false">${dots}</svg>`;
  }

  const SWITCH_MARKUP =
    '<span class="theme-switch__track" aria-hidden="true">' +
    '<span class="theme-switch__knob">' +
    pixelIcon(SUN, 'theme-switch__icon theme-switch__icon--sun') +
    pixelIcon(MOON, 'theme-switch__icon theme-switch__icon--moon') +
    '</span></span>';

  function enhance(root) {
    (root || document).querySelectorAll('.theme-switch[data-theme-toggle]').forEach((button) => {
      if (button.dataset.enhanced === 'true') return;
      button.dataset.enhanced = 'true';
      button.innerHTML = SWITCH_MARKUP;
    });
  }

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
    const next = theme === 'dark' ? 'claro' : 'escuro';
    document.querySelectorAll('[data-theme-toggle], #themeToggle').forEach((button) => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      if (button.classList.contains('theme-switch')) {
        button.setAttribute('aria-label', `Ativar tema ${next}`);
        button.title = `Ativar tema ${next}`;
      } else {
        button.textContent = theme === 'dark' ? '☀ Tema claro' : '🌙 Tema escuro';
      }
    });
  }

  function applyTheme(theme, { animate = false } = {}) {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Transicao suave de cores so na troca feita pelo usuario.
    if (animate && !reduceMotion) {
      root.classList.add('theme-transition');
      window.clearTimeout(applyTheme.timer);
      applyTheme.timer = window.setTimeout(() => root.classList.remove('theme-transition'), 500);
    }

    root.setAttribute('data-theme', theme);
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

  document.addEventListener('DOMContentLoaded', () => {
    enhance();
    syncToggles(currentTheme());
  });

  // Delegado: funciona tambem para botoes criados depois (barra lateral do painel).
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-theme-toggle], #themeToggle')) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', { animate: true });
  });

  window.PLTheme = {
    apply: applyTheme,
    current: currentTheme,
    sync: syncToggles,
    enhance(root) {
      enhance(root);
      syncToggles(currentTheme());
    },
  };
})();
