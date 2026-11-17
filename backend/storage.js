// Upload das imagens de produto e do logo.
//
// - Firebase (DB_PROVIDER=firestore ou STORAGE_PROVIDER=firebase): Cloud
//   Storage do projeto, pasta produtos/. As regras (storage.rules) deixam ler
//   so essa pasta; gravar, so o backend.
// - Supabase (padrao da camada SQL): bucket publico "pizzaria-uploads".
//
// O arquivo chega aqui ja validado pela rota (tipo conferido pela assinatura
// do arquivo e tamanho maximo).
const crypto = require('node:crypto');

const BUCKET_NAME = 'pizzaria-uploads';

function useFirebase() {
  const storage = String(process.env.STORAGE_PROVIDER || '').toLowerCase();
  const database = String(process.env.DB_PROVIDER || '').toLowerCase();
  return storage === 'firebase' || (storage === '' && database === 'firestore');
}

function buildFileName(originalName) {
  const safeName = String(originalName || 'imagem').replace(/[^a-zA-Z0-9.]/g, '-');
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
}

// ------------------------------------------------------------- Firebase

async function uploadToFirebase(buffer, originalName, mimeType) {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('Configure FIREBASE_STORAGE_BUCKET no ambiente para habilitar upload de imagens.');
  }

  const { getStorage } = require('firebase-admin/storage');
  const { getApp } = require('./db/firestore/client');
  const bucket = getStorage(getApp()).bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const path = `produtos/${buildFileName(originalName)}`;
  // Token de download: e o que torna a URL publica estavel (mesmo formato que
  // o console do Firebase gera).
  const token = crypto.randomUUID();

  await bucket.file(path).save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

// ------------------------------------------------------------- Supabase

let supabaseClient = null;
let bucketReady = false;

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env para habilitar upload de imagens.');
  }

  const { createClient } = require('@supabase/supabase-js');
  supabaseClient = createClient(url, serviceKey);
  return supabaseClient;
}

async function ensureSupabaseBucket() {
  if (bucketReady) {
    return;
  }

  const supabase = getSupabase();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Não foi possível acessar o Supabase Storage: ${listError.message}`);
  }

  if (!(buckets || []).some((bucket) => bucket.name === BUCKET_NAME)) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Não foi possível criar o bucket de upload: ${createError.message}`);
    }
  }

  bucketReady = true;
}

async function uploadToSupabase(buffer, originalName, mimeType) {
  await ensureSupabaseBucket();
  const supabase = getSupabase();
  const fileName = buildFileName(originalName);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });
  if (uploadError) {
    throw new Error(`Falha ao enviar imagem: ${uploadError.message}`);
  }

  return supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName).data.publicUrl;
}

async function uploadImage(buffer, originalName, mimeType) {
  return useFirebase()
    ? uploadToFirebase(buffer, originalName, mimeType)
    : uploadToSupabase(buffer, originalName, mimeType);
}

module.exports = {
  uploadImage,
};
