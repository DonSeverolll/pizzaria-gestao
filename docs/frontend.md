# Frontend PL Pizza (`public/`)

HTML, CSS e JavaScript puros, **sem build e sem framework**. O Express serve esta
pasta como arquivos estáticos (`express.static('public')`), então o caminho no disco
é o caminho na URL: `public/js/core.js` → `/js/core.js`.

```
public/
├── index.html            vitrine (cardápio, carrinho, checkout)
├── app.js                lógica da vitrine
├── admin*.html           telas do painel
├── admin-*.js, admin.js  lógica de cada tela do painel
├── admin-shell.js        barra lateral do painel (menu único, filtrado por perfil)
├── theme.js              tema claro/escuro + chave animada (sol/lua em pixel)
├── js/core.js            núcleo compartilhado: window.PL (api, auth, format, dom)
├── js/art.js             ilustrações SVG da marca: window.PLArt
├── styles.css            ÍNDICE: só @import dos arquivos de css/
└── css/
    ├── tokens.css        cores, escalas e breakpoints (fonte única do design)
    ├── base/             reset, elementos globais, utilitários
    ├── components/       peças compartilhadas (botões, modal, chave de tema)
    ├── storefront/       vitrine antiga (classes ainda usadas pelo painel)
    ├── site/             VITRINE v2 (só vale em <body class="site">)
    ├── admin/            painel (+ admin/v2.css: identidade v2)
    └── print.css         impressão
```

---

## 0. Identidade v2 (redesign)

Inspirada em sites "pôster" de comida: títulos altos e condensados (**Anton**),
seções vinho, painéis rosados, barra de navegação vermelha flutuante, rótulos
entre colchetes (`[ Cardápio ]`) e botões tipo ingresso (`› Ver cardápio ‹`).

- **Camada por cima do antigo:** `css/site/*.css` e `css/admin/v2.css` são os
  últimos imports de `styles.css` e valem só em `body.site` (vitrine) e
  `body.admin-v2` (painel). O CSS antigo continua carregado porque o painel
  usa várias classes dele.
- **Tokens novos:** paleta `--pl-*` (fixa) e semânticos `--site-*` (mudam com
  o tema) na seção 3 de `tokens.css`. Fontes: `--font-display` e `--font-body`.
- **Chave de tema:** qualquer `<button class="theme-switch" data-theme-toggle>`
  vira a chave animada (`theme.js` gera o miolo). No painel, o
  `admin-shell.js` já coloca uma na barra lateral.
- **Ilustrações:** sem fotos no cardápio, `PLArt.forProduct(produto)` desenha
  cada sabor (cobertura própria) e cada bebida em SVG. Para peças soltas use
  `<img data-art="decor:basil">` (slice, tomato, basil, chili, mushroom) ou
  `<img data-art="pizza:margherita">`. Foto `https://` cadastrada no produto
  tem prioridade sobre a ilustração.
- **Seções da vitrine:** hero pôster, faixa corrida, "como quer receber",
  cardápio (abas com contador), comanda (carrinho em papel serrilhado), como
  funciona, visite (ingresso picotado), dúvidas e rodapé.
- **Cuidado com acentos na Anton:** o acento de maiúsculas (Ê, Á) é alto e
  encosta na linha de cima em títulos de duas linhas.
- **Movimento:** animações respeitam `prefers-reduced-motion`.

---

## 1. Tokens: marca e tema

Tudo que é "decisão de design" fica em **`css/tokens.css`**.

- **Trocar a marca:** altere `--primary`, `--primary-deep`, `--brand-red`,
  `--brand-dark`, `--accent` e `--red-soft`.
- **Superfícies e texto:** `--bg`, `--panel`, `--surface`, `--text`, `--muted`, `--line`.
- **Tema escuro:** só o que muda vai em `:root[data-theme='dark']`. O atributo
  `data-theme` no `<html>` é controlado por `theme.js` (salvo em
  `localStorage['pl-pizzas-theme']`; sem escolha salva, segue o sistema). Qualquer
  botão com `data-theme-toggle` (ou `#themeToggle`) alterna o tema.
- **Escalas para o redesign** (já existem, ainda não usadas pelas regras atuais):
  `--space-*`, `--radius-*`, `--shadow-sm|md|lg|primary|drawer-*`, `--font-sans`,
  `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--letter-spacing-*`,
  `--z-sidebar|header|overlay`, `--duration-*`, `--easing-standard`.
  Os valores são **iguais aos literais usados hoje**: trocar `12px` por
  `var(--radius-sm)` não muda nada na tela. Migre aos poucos.
- **Breakpoints** (variável CSS não funciona em `@media`, use os números):
  `680px` celular · `720px` painel compacto · `900px` tablet · `980px` some a navegação
  do topo. Sempre `max-width` (desktop primeiro).

> **Atenção — `--shadow` é uma cor, não uma sombra.** As regras
> `box-shadow: var(--shadow)` são inválidas para o navegador e hoje **não desenham
> sombra nenhuma**. Se "consertar" o token, cartões da vitrine e do painel inteiros
> ganham sombra. Para sombras use a escala `--shadow-sm/md/lg`.

---

## 2. CSS: mapa e ordem de importação

Todas as páginas carregam só `/styles.css`, que importa os arquivos abaixo **nesta
ordem**. Cada arquivo é um trecho contínuo do antigo `styles.css` (1780 linhas), na
ordem original: é isso que garante que a cascata é idêntica à de antes. Por isso
algumas áreas aparecem "intercaladas" (ex.: o PDV vem antes do reset).

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 1 | `css/tokens.css` | custom properties (claro/escuro) + escalas novas |
| 2 | `css/admin/pdv.css` | painel: PDV / balcão |
| 3 | `css/components/theme-toggle.css` | botões de tema (topo da vitrine e barra do painel), imagens no escuro |
| 4 | `css/base/reset.css` | `box-sizing`, `html`, `body`, `.hidden` |
| 5 | `css/storefront/sidebar.css` | menu lateral do cliente, hambúrguer, painel do cliente (também `.admin-brand`, `.form-message`, `.customer-list`) |
| 6 | `css/base/elements.css` | `a`, `button/input/select`, `img`, `.container` |
| 7 | `css/storefront/topbar.css` | barra superior, modo de pedido, pílulas de endereço/carrinho |
| 8 | `css/storefront/menu-gate.css` | bloqueio do cardápio sem endereço |
| 9 | `css/components/modal.css` | modal |
| 10 | `css/storefront/hero.css` | hero, etiquetas `.eyebrow` / `.section-kicker` / `.promo-tag` |
| 11 | `css/components/buttons.css` | `.button` (`.primary`, `.secondary`, `.ghost`, `.full`) — vitrine e painel |
| 12 | `css/storefront/promo.css` | cartão do hero, selo, banner promocional |
| 13 | `css/storefront/menu.css` | busca, abas de categoria, cardápio, opções do produto |
| 14 | `css/storefront/checkout.css` | carrinho e checkout (`.two-columns` e `.cart-controls` também no painel) |
| 15 | `css/storefront/info.css` | QR code e visita |
| 16 | `css/storefront/responsive.css` | responsivo da vitrine |
| 17 | `css/admin/layout.css` | estrutura do painel, barra lateral, login, `.form-group`, cabeçalho |
| 18 | `css/admin/cards.css` | resumo, cartões, `.table-status`, `.inline-button` |
| 19 | `css/admin/forms.css` | formulários, upload, preview de logo |
| 20 | `css/admin/data.css` | estoque baixo, `.muted-text`, movimentos, `.data-table`, selos ABC |
| 21 | `css/print.css` | impressão (relatório de lucro) |
| 22 | `css/admin/estoque.css` | `.stock-grid` / `.stock-item` (estoque e horários) |
| 23 | `css/base/utilities.css` | utilitários (hoje só uma cópia de `.hidden`) |
| 24 | `css/admin/responsive.css` | responsivo do painel |

Regras:

- **Não reordene os `@import`** sem conferir se alguma regra movida disputa a mesma
  propriedade/especificidade com outra. **Não use `@layer`** (muda a precedência).
- Regra nova de uma área: coloque no fim do arquivo da área. Componente novo
  compartilhado: crie `css/components/<nome>.css` e importe-o **depois** dos arquivos
  que ele precisa sobrescrever (no fim da lista, se for novo de verdade).
- `@import` só funciona antes de qualquer regra em `styles.css`.
- Use tokens (`var(--...)`) em tudo que for novo.

---

## 3. JavaScript: núcleo `PL` (`js/core.js`)

Script clássico (sem `import`/`export`) que cria um único global: `window.PL`.
Precisa ser carregado **antes** do script da página. `admin-shell.js` também depende
dele (como é `defer`, roda depois de todos os scripts do fim do `<body>`).

### `PL.auth`

```js
PL.auth.getToken();          // localStorage['pizzaria-token'] (token do painel)
PL.auth.setToken(token);
PL.auth.clearToken();
const token = PL.auth.requireToken(); // sem token, manda para /admin

// Sessão do cliente da vitrine: localStorage['pl-pizzas-session'] = { token, user }
PL.auth.getSession(); PL.auth.setSession({ token, user }); PL.auth.clearSession();
```

### `PL.api`

```js
// Cliente da página com opções padrão (equivale ao antigo apiFetch):
const token = PL.auth.requireToken();
const apiFetch = PL.api.client({ token });

const produtos = await apiFetch('/api/products');               // GET
await apiFetch('/api/products', { method: 'POST', body: { name: 'Calabresa' } }); // objeto vira JSON
await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) }); // string vai como está
await apiFetch('/api/uploads/image', { method: 'POST', body: formData });           // FormData sem Content-Type

try {
  await apiFetch('/api/inventory/9', { method: 'DELETE' }); // 204 -> null
} catch (error) {
  error.message; // "message" do servidor ou o fallback
  error.status;  // status HTTP
  error.data;    // corpo JSON do erro
}
```

Opções (no `client(...)` ou em cada chamada):

| Opção | Padrão | O que faz |
|-------|--------|-----------|
| `token` | lê `PL.auth.getToken()` a cada chamada | token do header `Authorization: Bearer ...` (só enviado se existir) |
| `onUnauthorized` | `'redirect'` | HTTP 401: `'redirect'` limpa o token e vai para `/admin`; `'none'` trata como erro comum; função = chamada antes do erro |
| `unauthorizedMessage` | `'Sessão expirada.'` | mensagem do erro no 401 |
| `errorMessage` | `'Erro inesperado.'` | mensagem quando o servidor não manda `message` |

Também: `Content-Type: application/json` é enviado sempre, exceto com `FormData`;
resposta 204 vira `null`; resposta que não é JSON vira `{}`.

Como cada tela usa hoje (comportamento antigo preservado):

| Tela | Configuração |
|------|--------------|
| `admin.js` (dashboard, mesas, pedidos) | token lido a cada chamada (o login é na própria página); 401 limpa o token e mostra o login, mensagem "Sessão expirada. Faça login novamente." |
| `admin-config.js` | `onUnauthorized: 'none'`, `errorMessage: 'Erro ao salvar configuração.'` (upload da logo: `'Erro ao enviar a logo.'`) |
| demais telas | `PL.api.client({ token })` com token lido na carga da página |

Fetch direto (sem `PL.api`) só onde um 401 não é "sessão expirada": login
(`/api/auth/login`), checagem do menu em `admin-shell.js` e endpoints públicos.

### `PL.format`

```js
PL.format.currency(12.5);      // "R$ 12,50"  (Intl, padrão para telas novas)
PL.format.currencyPlain(1234); // "R$ 1234,00" (relatório de lucro)
PL.format.currencyDot(12.5);   // "R$ 12.50"  (formato legado: mesas, pedidos, produtos, caixa)
PL.format.dateTime('2024-05-01 19:30:00'); // "01/05/2024, 19:30:00"
PL.format.date('2024-05-01 19:30:00');     // "01/05/2024"
PL.format.onlyDigits('(81) 9999-0000');    // "8199990000"
PL.format.telNumber('+55 81 9999-0000');   // "+558199990000" (para href="tel:")
```

### `PL.dom`

```js
PL.dom.escapeHtml(valor);   // escapa & < > " ' `  — obrigatório em innerHTML
PL.dom.safeUrl(url);        // url se for http(s) ou "/caminho"; senão ''
PL.dom.byId('id'); PL.dom.qs('.seletor'); PL.dom.qsa('.seletor'); // qsa devolve Array
```

### Segurança (obrigatório)

- **Todo valor vindo da API/banco** que entra em `innerHTML` ou template string de
  HTML passa por `PL.dom.escapeHtml(...)`, **inclusive em atributos** (`value`,
  `data-*`, `href`, `src`, `alt`, `title`). Mensagens de erro (`error.message`) também.
  Quando der, prefira `textContent`.
- URL vinda da API em `href`/`src`: passe por `PL.dom.safeUrl(...)` antes.
- O servidor usa **Content-Security-Policy** (`script-src 'self'`): nada de
  `<script>` inline, `onclick="..."` ou links `javascript:`. Estilo inline
  (`style="..."`) é permitido. Imagens: `'self'`, `data:` e `https:`.

---

## 4. Checklist: nova página do painel

1. Copie a estrutura de uma página existente (ex.: `admin-estoque.html`):
   - no `<head>`: fonte Inter, `<link rel="stylesheet" href="/styles.css" />`,
     `<script src="/theme.js"></script>` (sem `defer`) e
     `<script src="/admin-shell.js" defer></script>`;
   - `<div class="admin-page">`, botão `#adminMenuToggle`, `<aside id="adminSidebar"
     class="admin-sidebar open" data-active="<chave>"></aside>` e `<main class="admin-content">`.
2. No fim do `<body>`, **nesta ordem**:
   ```html
   <script src="/js/core.js"></script>
   <script src="/admin-nova.js"></script>
   ```
3. No script da página: `const token = PL.auth.requireToken();` e
   `const apiFetch = PL.api.client({ token });`. Não copie helpers (`apiFetch`,
   `toCurrency`, token...): use `PL.*`.
4. **Não** registre clique em `#adminMenuToggle`: `admin-shell.js` já faz isso
   (registrar de novo faz o menu abrir e fechar no mesmo clique).
5. Escape todo dado da API (`PL.dom.escapeHtml`) e não use script/handler inline.
6. Adicione o item em `NAV_ITEMS` de `admin-shell.js` (com a `area` de permissão;
   `'owner'` = só dono). A permissão de verdade é checada no servidor.
7. Estilos novos: arquivo em `css/admin/` + `@import` no `styles.css`, usando tokens.
8. Teste nos dois temas (claro/escuro) e em 720px / 900px de largura.

---

## 5. Pendências conhecidas (mantidas de propósito nesta reorganização)

- **Botão do menu do painel não funciona** em dashboard, mesas, pedidos, config,
  estoque, lucro e produtos: o script da página e o `admin-shell.js` registram o mesmo
  clique, então o menu abre e fecha junto. Correção: apagar o bloco marcado com
  `ATENCAO` nesses scripts.
- `box-shadow: var(--shadow)` não desenha sombra (ver seção 1).
- Três formatos de moeda convivem (`currency`, `currencyPlain`, `currencyDot`);
  padronizar em `currency()` no redesign.
- `app.js` (vitrine) ainda tem seus próprios helpers de sessão e moeda (`toCurrency`
  mostra "R$ NaN" para valor vazio, diferente de `PL.format.currency`); só o escape
  de HTML usa `PL`.
- Em `admin-estoque.js` a data dos movimentos não passa por `PL.format.dateTime`
  (sem o ajuste do Safari); trocar muda a exibição nesse navegador.
- Os botões de status dos pedidos (`admin.js`) não tratam erro: se o servidor
  recusar (ex.: 403 de permissão), nada aparece na tela.
