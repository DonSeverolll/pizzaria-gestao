// Nucleo compartilhado do frontend (painel e vitrine).
// Script classico (sem modulos, sem build): expoe um unico global, window.PL.
// Carregue ANTES do script da pagina:
//   <script src="/js/core.js"></script>
//   <script src="/admin-xxx.js"></script>
// admin-shell.js (carregado com defer) tambem depende deste arquivo.
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // PL.auth - token do painel e sessao do cliente (mesmas chaves de sempre)
  // ---------------------------------------------------------------------------
  const TOKEN_KEY = 'pizzaria-token';      // token JWT do painel (funcionarios)
  const SESSION_KEY = 'pl-pizzas-session'; // { token, user } do cliente na vitrine
  const LOGIN_PAGE = '/admin';

  const auth = {
    TOKEN_KEY,
    SESSION_KEY,
    LOGIN_PAGE,

    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },

    setToken(token) {
      localStorage.setItem(TOKEN_KEY, token);
    },

    clearToken() {
      localStorage.removeItem(TOKEN_KEY);
    },

    // Le o token na carga da pagina; sem token, manda para o login.
    // Como antes, o script da pagina continua rodando enquanto o navegador
    // navega (as chamadas seguintes recebem 401 e redirecionam de novo).
    requireToken(redirectTo = LOGIN_PAGE) {
      const token = auth.getToken();
      if (!token) {
        window.location.href = redirectTo;
      }
      return token;
    },

    // Sessao do cliente da vitrine (mesmo formato usado em app.js).
    getSession() {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      } catch (error) {
        return {};
      }
    },

    setSession(session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },

    clearSession() {
      localStorage.removeItem(SESSION_KEY);
    },
  };

  // ---------------------------------------------------------------------------
  // PL.api - fetch para a API com token, JSON e erros padronizados
  // ---------------------------------------------------------------------------

  // Erro padrao da API: message vem do servidor (data.message) ou do fallback.
  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  // Objeto literal ({ ... }); FormData, Blob, URLSearchParams etc. ficam de fora.
  function isPlainObject(value) {
    if (Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }

  // Opcoes (alem das do fetch: method, body, headers...):
  //   token               token a enviar. Padrao: le PL.auth.getToken() a cada chamada.
  //   onUnauthorized      o que fazer com HTTP 401:
  //                         'redirect' (padrao) limpa o token e vai para /admin;
  //                         'none' trata como erro comum (mensagem do servidor);
  //                         funcao: e chamada com a resposta antes do erro.
  //   unauthorizedMessage mensagem do erro lancado no 401 (padrao 'Sessão expirada.').
  //   errorMessage        mensagem quando o servidor nao manda "message".
  // Corpo: FormData vai como esta (o navegador define o Content-Type com
  // boundary); objeto simples vira JSON; string e enviada sem mudanca.
  // Retorno: JSON da resposta; null em 204; {} se a resposta nao for JSON.
  async function request(path, options = {}) {
    const {
      token,
      onUnauthorized = 'redirect',
      unauthorizedMessage = 'Sessão expirada.',
      errorMessage = 'Erro inesperado.',
      headers: extraHeaders,
      body,
      ...fetchOptions
    } = options;

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = isFormData
      ? { ...(extraHeaders || {}) }
      : { 'Content-Type': 'application/json', ...(extraHeaders || {}) };

    const authToken = token === undefined ? auth.getToken() : token;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const init = { ...fetchOptions, headers };
    if (body !== undefined) {
      init.body = !isFormData && isPlainObject(body) ? JSON.stringify(body) : body;
    }

    const response = await fetch(path, init);

    if (response.status === 401 && onUnauthorized && onUnauthorized !== 'none') {
      if (typeof onUnauthorized === 'function') {
        onUnauthorized(response);
      } else {
        auth.clearToken();
        window.location.href = LOGIN_PAGE;
      }
      throw new ApiError(unauthorizedMessage, 401, null);
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError((data && data.message) || errorMessage, response.status, data);
    }

    return data;
  }

  // Cria um "apiFetch" com opcoes padrao da pagina. As opcoes de cada chamada
  // sobrescrevem as padrao. Ex.: const apiFetch = PL.api.client({ token });
  function client(defaults = {}) {
    return (path, options = {}) => request(path, { ...defaults, ...options });
  }

  const api = { request, client, ApiError };

  // ---------------------------------------------------------------------------
  // PL.format - moeda e datas (pt-BR)
  // ---------------------------------------------------------------------------
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const format = {
    // "R$ 1.234,50" (Intl). Padrao recomendado para telas novas.
    currency(value) {
      return currencyFormatter.format(Number(value || 0));
    },

    // "R$ 1234,50" (sem separador de milhar). Formato atual do relatorio de lucro.
    currencyPlain(value) {
      return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
    },

    // "R$ 1234.50" (ponto decimal). Formato legado de mesas/pedidos/produtos/caixa;
    // no redesign, troque por currency().
    currencyDot(value) {
      return `R$ ${Number(value || 0).toFixed(2)}`;
    },

    // Datas do banco chegam como "2024-05-01 19:30:00"; o "T" deixa o formato
    // aceito por todos os navegadores (Safari rejeita o espaco).
    parseDate(value) {
      return new Date(String(value).replace(' ', 'T'));
    },

    // "01/05/2024, 19:30:00"
    dateTime(value) {
      return format.parseDate(value).toLocaleString('pt-BR');
    },

    // "01/05/2024"
    date(value) {
      return format.parseDate(value).toLocaleDateString('pt-BR');
    },

    onlyDigits(value) {
      return String(value || '').replace(/\D/g, '');
    },

    // Telefone para href="tel:...": so digitos e "+".
    telNumber(value) {
      return String(value || '').replace(/[^\d+]/g, '');
    },
  };

  // ---------------------------------------------------------------------------
  // PL.dom - escape de HTML e atalhos de consulta
  // ---------------------------------------------------------------------------
  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
  };

  const dom = {
    // Use em TODO valor vindo da API/banco que entra em innerHTML ou em
    // template string de HTML, inclusive dentro de atributos (value, data-*,
    // href, src, alt...). Mesmo resultado de `${valor}` para texto comum
    // (undefined/null continuam virando "undefined"/"null"). Quando der, prefira
    // textContent.
    escapeHtml(value) {
      return String(value).replace(/[&<>"'`]/g, (char) => HTML_ESCAPES[char]);
    },

    // Devolve a URL se for http(s) ou caminho do proprio site ("/..."); senao ''.
    // Use em src/href montados com dados da API (bloqueia javascript:, data: etc.).
    safeUrl(value) {
      const url = String(value || '').trim();
      return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : '';
    },

    byId(id) {
      return document.getElementById(id);
    },

    qs(selector, root = document) {
      return root.querySelector(selector);
    },

    // Devolve um Array (da para usar map/filter direto).
    qsa(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    },
  };

  window.PL = { auth, api, format, dom };
})();
