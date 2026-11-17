// Ilustracoes da marca desenhadas em SVG (window.PLArt).
//
// O cardapio nao tem fotos: cada produto ganha uma ilustracao propria,
// gerada aqui como data URL (permitido pela CSP em img-src). As coberturas
// sao posicionadas por um sorteio com semente fixa, entao a mesma pizza sai
// sempre igual.
//
//   PLArt.forProduct({ name, category })  -> data URL para o card do cardapio
//   PLArt.pizza('margherita', { bg })     -> pizza vista de cima
//   PLArt.decor('basil')                  -> pecas soltas do hero
//   <img data-art="decor:tomato">         -> preenchido sozinho ao carregar
(function () {
  const COLORS = {
    crust: '#e7a654',
    crustEdge: '#c98436',
    sauce: '#d8402a',
    cheese: '#f8d47c',
    cheeseDeep: '#f0bf55',
    basil: '#2f8a4a',
    basilDeep: '#1f6b45',
    tomato: '#e2483a',
    ink: '#3b0a14',
  };

  // Sorteio deterministico (LCG) a partir de um texto.
  function seeded(text) {
    let seed = 0;
    for (const char of String(text)) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  // Pontos espalhados dentro de um circulo, sem encostar demais uns nos outros.
  function scatter(random, count, radius, minGap) {
    const points = [];
    let attempts = 0;
    while (points.length < count && attempts < count * 60) {
      attempts += 1;
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const point = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, r: random() };
      if (points.every((other) => Math.hypot(other.x - point.x, other.y - point.y) >= minGap)) {
        points.push(point);
      }
    }
    return points;
  }

  function toDataUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s{2,}/g, ' '))}`;
  }

  // ------------------------------------------------------------- Coberturas

  const TOPPINGS = {
    calabresa(random, r) {
      let out = '';
      for (const p of scatter(random, 9, r * 0.62, r * 0.32)) {
        out += `<g transform="translate(${p.x} ${p.y})"><circle r="${r * 0.13}" fill="#b5392b"/><circle r="${r * 0.095}" fill="#c94a3a"/><circle cx="${-r * 0.03}" cy="${r * 0.02}" r="${r * 0.015}" fill="#f2b8a6"/><circle cx="${r * 0.04}" cy="${-r * 0.03}" r="${r * 0.013}" fill="#f2b8a6"/></g>`;
      }
      for (const p of scatter(random, 7, r * 0.66, r * 0.2)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.075}" fill="none" stroke="#f6eadf" stroke-width="${r * 0.025}" opacity=".9"/>`;
      }
      return out;
    },
    pepperoni(random, r) {
      let out = '';
      for (const p of scatter(random, 11, r * 0.64, r * 0.27)) {
        out += `<g transform="translate(${p.x} ${p.y})"><circle r="${r * 0.12}" fill="#a3241c"/><circle r="${r * 0.12}" fill="none" stroke="#7d1812" stroke-width="${r * 0.02}"/><circle cx="${r * 0.03}" cy="${-r * 0.02}" r="${r * 0.02}" fill="#7d1812"/></g>`;
      }
      for (const p of scatter(random, 22, r * 0.7, r * 0.06)) {
        out += `<rect x="${p.x}" y="${p.y}" width="${r * 0.03}" height="${r * 0.018}" rx="1" fill="#e2483a" transform="rotate(${p.r * 180} ${p.x} ${p.y})"/>`;
      }
      return out;
    },
    margherita(random, r) {
      let out = '';
      for (const p of scatter(random, 6, r * 0.58, r * 0.36)) {
        out += `<g transform="translate(${p.x} ${p.y})"><circle r="${r * 0.12}" fill="${COLORS.tomato}"/><circle r="${r * 0.08}" fill="#f0705f"/></g>`;
      }
      for (const p of scatter(random, 7, r * 0.6, r * 0.3)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.13}" fill="#fffaf0" opacity=".95"/>`;
      }
      for (const p of scatter(random, 8, r * 0.62, r * 0.22)) {
        const angle = p.r * 360;
        out += `<g transform="translate(${p.x} ${p.y}) rotate(${angle})"><ellipse rx="${r * 0.11}" ry="${r * 0.05}" fill="${COLORS.basil}"/><path d="M${-r * 0.1} 0H${r * 0.1}" stroke="${COLORS.basilDeep}" stroke-width="${r * 0.012}"/></g>`;
      }
      return out;
    },
    portuguesa(random, r) {
      let out = '';
      for (const p of scatter(random, 6, r * 0.6, r * 0.3)) {
        out += `<rect x="${p.x - r * 0.1}" y="${p.y - r * 0.07}" width="${r * 0.2}" height="${r * 0.14}" rx="${r * 0.03}" fill="#f19c98" transform="rotate(${p.r * 90} ${p.x} ${p.y})"/>`;
      }
      for (const p of scatter(random, 4, r * 0.55, r * 0.4)) {
        out += `<g transform="translate(${p.x} ${p.y})"><ellipse rx="${r * 0.14}" ry="${r * 0.11}" fill="#fffaf0"/><circle r="${r * 0.065}" fill="#f6b52a"/></g>`;
      }
      for (const p of scatter(random, 9, r * 0.66, r * 0.16)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.045}" fill="#2b1d1d"/><circle cx="${p.x}" cy="${p.y}" r="${r * 0.017}" fill="#6e5a5d"/>`;
      }
      return out;
    },
    frango(random, r) {
      let out = '';
      for (const p of scatter(random, 26, r * 0.66, r * 0.09)) {
        out += `<rect x="${p.x}" y="${p.y}" width="${r * 0.11}" height="${r * 0.035}" rx="${r * 0.015}" fill="#e6bd80" transform="rotate(${p.r * 180} ${p.x} ${p.y})"/>`;
      }
      for (const p of scatter(random, 6, r * 0.55, r * 0.32)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.12}" fill="#fffdf6" stroke="#efdcb9" stroke-width="${r * 0.02}"/>`;
      }
      for (const p of scatter(random, 10, r * 0.66, r * 0.2)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.02}" fill="${COLORS.basil}"/>`;
      }
      return out;
    },
    chocolate(random, r) {
      let out = `<path d="M${-r * 0.6} ${-r * 0.2} q ${r * 0.3} ${-r * 0.25} ${r * 0.6} 0 t ${r * 0.6} 0" fill="none" stroke="#fff3e6" stroke-width="${r * 0.03}" stroke-linecap="round" opacity=".85"/>`;
      for (const p of scatter(random, 7, r * 0.6, r * 0.3)) {
        out += `<g transform="translate(${p.x} ${p.y}) rotate(${p.r * 60 - 30})"><path d="M0 ${r * 0.13} C ${-r * 0.14} ${r * 0.03} ${-r * 0.11} ${-r * 0.1} 0 ${-r * 0.07} C ${r * 0.11} ${-r * 0.1} ${r * 0.14} ${r * 0.03} 0 ${r * 0.13} Z" fill="#e43b4b"/><path d="M${-r * 0.05} ${-r * 0.08} L0 ${-r * 0.03} L${r * 0.05} ${-r * 0.08}" stroke="${COLORS.basil}" stroke-width="${r * 0.03}" fill="none" stroke-linecap="round"/><circle cx="${-r * 0.03}" cy="${r * 0.02}" r="${r * 0.008}" fill="#ffd2d6"/><circle cx="${r * 0.03}" cy="${r * 0.04}" r="${r * 0.008}" fill="#ffd2d6"/></g>`;
      }
      return out;
    },
    banana(random, r) {
      let out = '';
      for (const p of scatter(random, 10, r * 0.62, r * 0.26)) {
        out += `<g transform="translate(${p.x} ${p.y})"><circle r="${r * 0.11}" fill="#f9e8a8" stroke="#ead27f" stroke-width="${r * 0.02}"/><circle r="${r * 0.025}" fill="#d9b85c"/></g>`;
      }
      for (const p of scatter(random, 40, r * 0.7, r * 0.05)) {
        out += `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.01}" fill="#8a4b26"/>`;
      }
      return out;
    },
  };

  const BASES = {
    chocolate: { sauce: '#4b2416', cheese: '#5e2f1d' },
    banana: { sauce: '#ead2a6', cheese: '#f3e2c3' },
  };

  function pizzaGroup(flavor, r, seedText) {
    const random = seeded(seedText || flavor);
    const base = BASES[flavor] || { sauce: COLORS.sauce, cheese: COLORS.cheese };
    const toppings = (TOPPINGS[flavor] || TOPPINGS.margherita)(random, r);
    const cuts = [0, 45, 90, 135]
      .map((angle) => `<line x1="${-r * 0.86}" y1="0" x2="${r * 0.86}" y2="0" transform="rotate(${angle})" stroke="rgba(70,20,10,.16)" stroke-width="${r * 0.018}"/>`)
      .join('');

    return `
      <ellipse cx="0" cy="${r * 0.12}" rx="${r * 1.02}" ry="${r * 0.98}" fill="rgba(40,8,12,.18)"/>
      <circle r="${r}" fill="${COLORS.crust}"/>
      <circle r="${r * 0.97}" fill="none" stroke="${COLORS.crustEdge}" stroke-width="${r * 0.035}" opacity=".55"/>
      <circle r="${r * 0.84}" fill="${base.sauce}"/>
      <path d="M0 ${-r * 0.78} C ${r * 0.45} ${-r * 0.8} ${r * 0.8} ${-r * 0.42} ${r * 0.77} ${r * 0.02} C ${r * 0.8} ${r * 0.5} ${r * 0.4} ${r * 0.8} ${-r * 0.05} ${r * 0.77} C ${-r * 0.5} ${r * 0.8} ${-r * 0.8} ${r * 0.42} ${-r * 0.76} ${-r * 0.04} C ${-r * 0.78} ${-r * 0.5} ${-r * 0.42} ${-r * 0.77} 0 ${-r * 0.78} Z" fill="${base.cheese}"/>
      ${cuts}
      ${toppings}
    `;
  }

  // Fundo dos cards: cor chapada, uma "bolha" ondulada e pontilhado leve.
  function cardBackground(bg, blob, id) {
    return `
      <defs>
        <pattern id="dots-${id}" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="rgba(59,10,20,.07)"/>
        </pattern>
      </defs>
      <rect width="600" height="420" fill="${bg}"/>
      <rect width="600" height="420" fill="url(#dots-${id})"/>
      <path d="M300 38 C 410 30 500 90 512 190 C 526 300 430 392 300 388 C 178 384 84 318 88 206 C 92 104 186 46 300 38 Z" fill="${blob}"/>
    `;
  }

  const PIZZA_STYLE = {
    calabresa: { bg: '#fde2d6', blob: '#f7c2ad' },
    pepperoni: { bg: '#ffe0dc', blob: '#f9b9b1' },
    margherita: { bg: '#e3f3e4', blob: '#bfe3c5' },
    portuguesa: { bg: '#fff0e1', blob: '#fbd5ae' },
    frango: { bg: '#fff4dc', blob: '#f9dfa0' },
    chocolate: { bg: '#fbe2ec', blob: '#f2bdd2' },
    banana: { bg: '#fff3d4', blob: '#f7dc95' },
  };

  function pizza(flavor, options = {}) {
    const style = PIZZA_STYLE[flavor] || PIZZA_STYLE.calabresa;
    if (options.transparent) {
      return toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220"><g>${pizzaGroup(flavor, 100, options.seed)}</g></svg>`);
    }
    return toDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
        ${cardBackground(options.bg || style.bg, options.blob || style.blob, flavor)}
        <g transform="translate(300 206)">${pizzaGroup(flavor, 150, options.seed)}</g>
      </svg>
    `);
  }

  // ---------------------------------------------------------------- Bebidas

  const DRINK_STYLE = {
    cola: { bg: '#fde2d6', blob: '#f6bcae', glass: '#3a1d12', label: '#d8232a', cap: '#d8232a' },
    zero: { bg: '#e7e9f3', blob: '#c9cee6', glass: '#2a1610', label: '#1c1c22', cap: '#1c1c22' },
    guarana: { bg: '#e2f2df', blob: '#bfe1b9', glass: '#7a3a12', label: '#1f7a3a', cap: '#1f7a3a' },
    pepsi: { bg: '#e0e8fb', blob: '#bccdf3', glass: '#2a1610', label: '#1d4d9a', cap: '#1d4d9a' },
    agua: { bg: '#def3fb', blob: '#b8e4f5', glass: '#bfe8f7', label: '#3a9fd0', cap: '#3a9fd0' },
    limao: { bg: '#eaf8d9', blob: '#cdeeaa', glass: '#d7ef9a', label: '#46a35f', cap: '#46a35f' },
  };

  function bottleGroup(style) {
    const bubbles = [
      [-22, 40, 4],
      [10, 70, 3],
      [-6, 110, 5],
      [20, 130, 3],
      [-18, 150, 3],
    ]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.35)"/>`)
      .join('');

    return `
      <ellipse cx="0" cy="182" rx="70" ry="12" fill="rgba(40,8,12,.18)"/>
      <rect x="-15" y="-150" width="30" height="20" rx="5" fill="${style.cap}"/>
      <path d="M-13 -130 h26 v26 c0 18 37 30 37 62 v214 c0 12 -9 20 -20 20 h-60 c-11 0 -20 -8 -20 -20 v-214 c0 -32 37 -44 37 -62 z" fill="${style.glass}" opacity=".92"/>
      <path d="M-28 -60 c 6 -10 14 -16 16 -26" stroke="rgba(255,255,255,.45)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <rect x="-50" y="10" width="100" height="70" rx="10" fill="${style.label}"/>
      <rect x="-36" y="34" width="72" height="8" rx="4" fill="rgba(255,255,255,.85)"/>
      <rect x="-26" y="50" width="52" height="6" rx="3" fill="rgba(255,255,255,.55)"/>
      <rect x="-40" y="-20" width="10" height="170" rx="5" fill="rgba(255,255,255,.18)"/>
      ${bubbles}
    `;
  }

  function drink(kind) {
    const style = DRINK_STYLE[kind] || DRINK_STYLE.cola;
    const lemon =
      kind === 'limao'
        ? '<g transform="translate(408 268)"><circle r="46" fill="#f4d23c"/><circle r="38" fill="#fbe98a"/><g stroke="#f4d23c" stroke-width="4">' +
          [0, 45, 90, 135].map((a) => `<line x1="-36" y1="0" x2="36" y2="0" transform="rotate(${a})"/>`).join('') +
          '</g></g>'
        : '';
    return toDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
        ${cardBackground(style.bg, style.blob, `drink-${kind}`)}
        <g transform="translate(300 214) scale(1.02)">${bottleGroup(style)}</g>
        ${lemon}
      </svg>
    `);
  }

  function dessert() {
    return toDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
        ${cardBackground('#fbe2ec', '#f2bdd2', 'dessert')}
        <g transform="translate(300 240)">
          <ellipse cy="96" rx="130" ry="18" fill="rgba(40,8,12,.18)"/>
          <path d="M-110 90 L-90 -10 H90 L110 90 Z" fill="#5e2f1d"/>
          <path d="M-96 -10 C -80 -70 80 -70 96 -10 Z" fill="#7b3f27"/>
          <path d="M-92 -12 c 20 22 40 -6 60 14 c 20 18 40 -12 60 8 c 20 16 40 -10 64 -22" stroke="#fff3e6" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M0 -82 C -22 -102 -18 -132 0 -122 C 18 -132 22 -102 0 -82 Z" fill="#e43b4b"/>
        </g>
      </svg>
    `);
  }

  // --------------------------------------------------------- Pecas do hero

  const DECOR = {
    tomato: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120"><circle r="50" fill="${COLORS.tomato}"/><circle cx="-16" cy="-14" r="12" fill="rgba(255,255,255,.28)"/><path d="M0 -44 l8 -12 l2 14 l14 -4 l-10 12 l12 8 l-16 0 l-6 12 l-4 -12 l-16 2 l12 -10 l-8 -12 l14 6 z" fill="${COLORS.basil}"/></svg>`,
    basil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120"><path d="M-44 36 C -40 -20 0 -50 48 -44 C 44 4 10 44 -44 36 Z" fill="${COLORS.basil}"/><path d="M-40 32 C -10 4 14 -18 44 -40" stroke="${COLORS.basilDeep}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-14 8 l-10 -18 M4 -8 l-6 -20 M14 -2 l18 2 M-4 14 l16 4" stroke="${COLORS.basilDeep}" stroke-width="3" stroke-linecap="round"/></svg>`,
    chili: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120"><path d="M-40 -30 C -10 -30 30 0 40 46 C 10 30 -30 6 -44 -18 Z" fill="#d7262c"/><path d="M-30 -20 C -8 -18 18 4 28 30" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-42 -26 C -50 -36 -46 -48 -34 -50" stroke="${COLORS.basil}" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`,
    slice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -70 140 140"><path d="M0 60 L-54 -40 C -20 -58 20 -58 54 -40 Z" fill="${COLORS.crust}"/><path d="M0 50 L-44 -30 C -16 -44 16 -44 44 -30 Z" fill="${COLORS.sauce}"/><path d="M0 46 L-40 -26 C -14 -38 14 -38 40 -26 Z" fill="${COLORS.cheese}"/><circle cx="-12" cy="-14" r="9" fill="#b5392b"/><circle cx="14" cy="-6" r="8" fill="#b5392b"/><circle cx="0" cy="18" r="7" fill="#b5392b"/><path d="M-26 -22 c 4 10 -2 18 2 30" stroke="${COLORS.cheeseDeep}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
    mushroom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120"><path d="M-46 4 C -46 -36 46 -36 46 4 Z" fill="#c9926b"/><rect x="-14" y="0" width="28" height="40" rx="10" fill="#f3e2c8"/><circle cx="-16" cy="-14" r="6" fill="#f3e2c8"/><circle cx="14" cy="-20" r="5" fill="#f3e2c8"/></svg>`,
  };

  function decor(name) {
    return toDataUrl(DECOR[name] || DECOR.tomato);
  }

  // ------------------------------------------------------ Escolha por produto

  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  const PIZZA_RULES = [
    ['calabresa', 'calabresa'],
    ['pepperoni', 'pepperoni'],
    ['margher', 'margherita'],
    ['portuguesa', 'portuguesa'],
    ['frango', 'frango'],
    ['chocolate', 'chocolate'],
    ['morango', 'chocolate'],
    ['banana', 'banana'],
  ];

  const DRINK_RULES = [
    ['zero', 'zero'],
    ['coca', 'cola'],
    ['guarana', 'guarana'],
    ['pepsi', 'pepsi'],
    ['agua', 'agua'],
    ['limon', 'limao'],
    ['h2oh', 'limao'],
  ];

  function forProduct(product) {
    const name = normalize(product?.name);
    const category = normalize(product?.category);

    if (category.includes('bebida') || DRINK_RULES.some(([key]) => name.includes(key))) {
      const match = DRINK_RULES.find(([key]) => name.includes(key));
      return drink(match ? match[1] : 'cola');
    }
    if (category.includes('sobremesa') || name.includes('gateau') || name.includes('bolo')) {
      return dessert();
    }
    const match = PIZZA_RULES.find(([key]) => name.includes(key));
    return pizza(match ? match[1] : 'calabresa', { seed: name });
  }

  // <img data-art="pizza:margherita"> / <img data-art="decor:basil">
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-art]').forEach((img) => {
      const [kind, value] = String(img.dataset.art).split(':');
      if (kind === 'pizza') img.src = pizza(value, { transparent: true, seed: img.dataset.seed || value });
      else if (kind === 'decor') img.src = decor(value);
      else if (kind === 'drink') img.src = drink(value);
    });
  }

  document.addEventListener('DOMContentLoaded', () => hydrate());

  window.PLArt = { pizza, drink, dessert, decor, forProduct, hydrate };
})();
