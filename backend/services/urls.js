// URL publica do site. Em producao defina PUBLIC_BASE_URL (ex.:
// https://plpizza.com.br): links de retorno do Mercado Pago, webhook e QR code
// nao podem depender do cabecalho Host enviado pelo cliente.
function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  return `${req.protocol}://${req.get('host')}`;
}

module.exports = { publicBaseUrl };
