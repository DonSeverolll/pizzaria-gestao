const { createClient } = require('@supabase/supabase-js');

const BUCKET_NAME = 'pizzaria-uploads';

let client = null;
let bucketReady = false;

function getClient() {
  if (client) {
    return client;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env para habilitar upload de imagens.');
  }

  client = createClient(url, serviceKey);
  return client;
}

async function ensureBucket() {
  if (bucketReady) {
    return;
  }

  const supabase = getClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Não foi possível acessar o Supabase Storage: ${listError.message}`);
  }

  const exists = (buckets || []).some((bucket) => bucket.name === BUCKET_NAME);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Não foi possível criar o bucket de upload: ${createError.message}`);
    }
  }

  bucketReady = true;
}

function buildFileName(originalName) {
  const safeName = String(originalName || 'imagem').replace(/[^a-zA-Z0-9.]/g, '-');
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${uniqueSuffix}-${safeName}`;
}

async function uploadImage(buffer, originalName, mimeType) {
  await ensureBucket();
  const supabase = getClient();
  const fileName = buildFileName(originalName);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(`Falha ao enviar imagem: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return data.publicUrl;
}

module.exports = {
  uploadImage,
};
