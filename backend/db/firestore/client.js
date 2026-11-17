// Conexao com o Cloud Firestore (firebase-admin) e utilitarios comuns.
//
// Credenciais, nesta ordem:
//   1. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (conta de servico; na
//      Vercel a chave vai com "\n" literais, convertidos aqui);
//   2. GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON da conta de servico);
//   3. emulador local (FIRESTORE_EMULATOR_HOST), que dispensa credencial.
//
// O backend usa o Admin SDK, que nao passa pelas regras de seguranca: as
// regras (firestore.rules) negam todo acesso direto pelo navegador.
const { initializeApp, getApps, cert, applicationDefault, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const APP_NAME = 'pizzaria';
let app = null;
let db = null;

function projectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-pizzaria';
}

function credential() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return cert({ projectId: projectId(), clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  return undefined; // emulador
}

function getDb() {
  if (!db) {
    // No emulador nao ha servidor de metadados do Google Cloud; sem isto o SDK
    // espera ~4 s tentando descobri-lo antes da primeira consulta.
    if (process.env.FIRESTORE_EMULATOR_HOST && !process.env.METADATA_SERVER_DETECTION) {
      process.env.METADATA_SERVER_DETECTION = 'none';
    }
    if (!process.env.FIRESTORE_EMULATOR_HOST && !credential()) {
      throw new Error(
        'Firestore sem credencial: configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY ' +
          '(ou rode com o emulador, FIRESTORE_EMULATOR_HOST).'
      );
    }
    // Chaves so entram quando tem valor: o firebase-admin recusa
    // "credential: undefined" (caso do emulador).
    const options = { projectId: projectId() };
    const resolvedCredential = credential();
    if (resolvedCredential) options.credential = resolvedCredential;
    if (process.env.FIREBASE_STORAGE_BUCKET) options.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    app = getApps().find((existing) => existing.name === APP_NAME) || initializeApp(options, APP_NAME);
    db = getFirestore(app);
    // Campos undefined sao ignorados em vez de derrubar a gravacao.
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

function getApp() {
  getDb();
  return app;
}

async function closeFirestore() {
  if (app) {
    const current = app;
    app = null;
    db = null;
    await deleteApp(current);
  }
}

// --------------------------------------------------------------- Datas

// Mesmo formato que o SQLite devolvia ("AAAA-MM-DD HH:MM:SS", UTC): o painel
// e os relatorios ja sabem ler e ordenar esse texto.
function formatTimestamp(value) {
  const date = value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;
  if (!date) return value ?? null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function now() {
  return Timestamp.now();
}

// Documento -> objeto no formato das linhas do banco SQL (snake_case,
// datas em texto). Mapas e listas aninhados tambem sao convertidos.
function convert(value) {
  if (value instanceof Timestamp) return formatTimestamp(value);
  if (Array.isArray(value)) return value.map(convert);
  if (value && typeof value === 'object' && !(value instanceof Buffer)) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, convert(inner)]));
  }
  return value;
}

function toRow(snapshot) {
  if (!snapshot || !snapshot.exists) return null;
  return convert(snapshot.data());
}

function rowsOf(querySnapshot) {
  return querySnapshot.docs.map((doc) => convert(doc.data()));
}

// ---------------------------------------------------- IDs numericos

// A API e o front usam IDs numericos (/api/orders/12). Cada colecao tem um
// contador em counters/{nome}, incrementado dentro da transacao que cria o
// documento. Leitura antes da gravacao, como o Firestore exige.
async function reserveId(transaction, counterName) {
  const ref = getDb().collection('counters').doc(counterName);
  const snapshot = await transaction.get(ref);
  const next = Number(snapshot.exists ? snapshot.data().value : 0) + 1;
  return { id: next, commit: () => transaction.set(ref, { value: next }) };
}

function docId(id) {
  return String(id);
}

// Chave segura para usar como ID de documento (logins, codigos, nomes):
// minusculas e sem "/".
function keyOf(text) {
  return encodeURIComponent(String(text ?? '').trim().toLowerCase()) || '_';
}

function isAlreadyExists(error) {
  return error?.code === 6 || /ALREADY_EXISTS/i.test(String(error?.message));
}

module.exports = {
  getDb,
  getApp,
  closeFirestore,
  projectId,
  Timestamp,
  FieldValue,
  now,
  formatTimestamp,
  convert,
  toRow,
  rowsOf,
  reserveId,
  docId,
  keyOf,
  isAlreadyExists,
};
