// Pequenos ajudantes para validar e limpar dados que chegam do navegador.

// Texto livre: corta no tamanho maximo e remove caracteres de controle.
// O escape para HTML continua sendo responsabilidade de quem exibe.
function cleanText(value, maxLength = 200) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
  return text || null;
}

// Telefone: so digitos, +, espaco, parenteses e hifen.
function cleanPhone(value) {
  const text = cleanText(value, 30);
  if (!text) return null;
  const phone = text.replace(/[^\d+()\s-]/g, '').trim();
  return phone || null;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// URL de imagem aceita: https://..., caminho do proprio site (/... ou nome de
// arquivo simples) ou texto curto sem marcacao (os emojis do cardapio).
// Devolve null quando o valor nao e aceitavel.
function cleanImageRef(value) {
  const text = cleanText(value, 500);
  if (!text) return '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(text)) return text;
  if (/^\/[^\s"'<>]*$/.test(text) && !text.startsWith('//')) return text;
  if (/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(text)) return text;
  if (text.length <= 16 && !/[<>"'`]/.test(text) && !/^[a-z]+:/i.test(text)) return text;
  return null;
}

module.exports = {
  cleanText,
  cleanPhone,
  positiveId,
  cleanImageRef,
};
