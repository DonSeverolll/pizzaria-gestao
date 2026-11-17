// Cadastro do cardapio no painel: produtos, adicionais e upload de imagens.
const express = require('express');
const multer = require('multer');

const {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllMenuItems,
  getExtras,
  createExtra,
  updateExtra,
  deleteExtra,
} = require('../db');
const { authMiddleware, requirePermission } = require('../auth');
const { uploadImage } = require('../storage');
const { handle, badRequest, notFound } = require('../http/errors');
const { cleanImageRef, positiveId } = require('../http/validation');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype)),
});

// O tipo informado pelo navegador nao basta: confere a assinatura do arquivo.
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (/^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) return { mime: 'image/gif', ext: 'gif' };
  return null;
}

// Aceita so imagem https, caminho do proprio site ou emoji.
function sanitizeProductImage(body) {
  if (body.image === undefined) return body;
  const image = cleanImageRef(body.image);
  if (image === null) {
    throw badRequest('Imagem inválida: use um endereço https, um arquivo enviado pelo painel ou um emoji.');
  }
  return { ...body, image };
}

const canEditCatalog = [authMiddleware, requirePermission('produtos')];

router.post(
  '/products',
  ...canEditCatalog,
  handle('Erro ao criar produto.', async (req, res) => {
    const product = sanitizeProductImage(req.body || {});
    if (!product.name || !product.category || !product.price) {
      throw badRequest('Nome, categoria e valor do produto são obrigatórios.');
    }
    if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
      throw badRequest('Valor do produto inválido.');
    }

    const result = await createProduct(product);
    res.status(201).json({ id: result.id, ...product });
  })
);

router.get(
  '/products',
  ...canEditCatalog,
  handle('Erro ao buscar produtos.', async (req, res) => {
    res.json(await getAllMenuItems());
  })
);

router.patch(
  '/products/:id',
  ...canEditCatalog,
  handle('Erro ao atualizar produto.', async (req, res) => {
    const product = sanitizeProductImage(req.body || {});
    if (product.price !== undefined && (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0)) {
      throw badRequest('Valor do produto inválido.');
    }

    const id = positiveId(req.params.id);
    const updated = id ? await updateProduct(id, product) : null;
    if (!updated) {
      throw notFound('Produto não encontrado.');
    }
    res.json(updated);
  })
);

router.delete(
  '/products/:id',
  ...canEditCatalog,
  handle('Erro ao excluir produto.', async (req, res) => {
    await deleteProduct(positiveId(req.params.id));
    res.status(204).end();
  })
);

router.get(
  '/admin/extras',
  ...canEditCatalog,
  handle('Erro ao buscar adicionais.', async (req, res) => {
    res.json(await getExtras());
  })
);

router.post(
  '/admin/extras',
  ...canEditCatalog,
  handle('Erro ao criar adicional.', async (req, res) => {
    const { name, price, category } = req.body || {};
    if (!name) {
      throw badRequest('Nome do adicional é obrigatório.');
    }
    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      throw badRequest('Valor do adicional inválido.');
    }
    res.status(201).json(await createExtra({ name, price, category }));
  })
);

router.patch(
  '/admin/extras/:id',
  ...canEditCatalog,
  handle('Erro ao atualizar adicional.', async (req, res) => {
    const body = req.body || {};
    if (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)) {
      throw badRequest('Valor do adicional inválido.');
    }
    const id = positiveId(req.params.id);
    const updated = id ? await updateExtra(id, body) : null;
    if (!updated) {
      throw notFound('Adicional não encontrado.');
    }
    res.json(updated);
  })
);

router.delete(
  '/admin/extras/:id',
  ...canEditCatalog,
  handle('Erro ao excluir adicional.', async (req, res) => {
    await deleteExtra(positiveId(req.params.id));
    res.status(204).end();
  })
);

router.post(
  '/uploads/image',
  ...canEditCatalog,
  upload.single('image'),
  handle('Erro ao enviar imagem.', async (req, res) => {
    if (!req.file) {
      throw badRequest('Envie uma imagem JPG, PNG, WEBP ou GIF.');
    }

    const detected = detectImageType(req.file.buffer);
    if (!detected) {
      throw badRequest('O arquivo enviado não é uma imagem válida.');
    }

    try {
      const url = await uploadImage(req.file.buffer, `imagem.${detected.ext}`, detected.mime);
      res.json({ url });
    } catch (error) {
      // Falta de configuracao do Supabase e mensagem util para o dono.
      error.statusCode = /^Configure (SUPABASE|FIREBASE)/.test(error.message) ? 503 : 500;
      error.expose = error.statusCode === 503;
      throw error;
    }
  })
);

module.exports = router;
