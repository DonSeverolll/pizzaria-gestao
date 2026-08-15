const QRCode = require('qrcode');

function field(id, value) {
  const length = String(value.length).padStart(2, '0');
  return `${id}${length}${value}`;
}

function sanitizeText(value, maxLength) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  return (normalized.slice(0, maxLength) || 'NA').toUpperCase();
}

function formatPixKey(key) {
  const trimmed = String(key || '').trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const looksLikePhone = /^\d{10,11}$/.test(digitsOnly) && !trimmed.includes('@') && !trimmed.includes('.');
  return looksLikePhone ? `+55${digitsOnly}` : trimmed;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ pixKey, merchantName, merchantCity, amount, txid }) {
  if (!pixKey) {
    throw new Error('Chave Pix não configurada. Cadastre em Configurações > Perfil da loja.');
  }

  const merchantAccountInfo = field('00', 'br.gov.bcb.pix') + field('01', formatPixKey(pixKey));
  const referenceLabel = String(txid || '***').slice(0, 25).replace(/[^a-zA-Z0-9]/g, '') || '***';
  const additionalData = field('05', referenceLabel);

  const parts = [
    field('00', '01'),
    field('01', '11'),
    field('26', merchantAccountInfo),
    field('52', '0000'),
    field('53', '986'),
  ];

  if (amount && Number(amount) > 0) {
    parts.push(field('54', Number(amount).toFixed(2)));
  }

  parts.push(field('58', 'BR'));
  parts.push(field('59', sanitizeText(merchantName, 25)));
  parts.push(field('60', sanitizeText(merchantCity, 15)));
  parts.push(field('62', additionalData));

  const payloadWithoutCrc = `${parts.join('')}6304`;
  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}

async function generatePixQrCode(payload) {
  return QRCode.toDataURL(payload, { margin: 1, width: 320 });
}

module.exports = {
  buildPixPayload,
  generatePixQrCode,
  formatPixKey,
};
