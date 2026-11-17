# PL Pizza — gestão de pizzaria

Cardápio público com pedidos online (dinheiro, Pix e cartão via Mercado Pago)
e painel administrativo com pedidos, PDV de balcão, produtos, estoque, mesas,
caixa, CRM, relatório de vendas, funcionários com perfis de acesso e
configurações da loja.

## Requisitos

- **Node.js 26 LTS** (versão fixada em `.nvmrc` e em `engines`)
- Nenhum banco para instalar no desenvolvimento: usa o SQLite embutido no Node
- Produção: **Cloud Firestore** (Firebase) ou Postgres/Supabase, escolhido por
  `DB_PROVIDER` (veja [Banco de dados](#banco-de-dados))
- Para os testes no Firestore: **Java 21** (o emulador do Firebase roda em Java)

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 (loja) e http://localhost:3000/admin (painel).
O primeiro boot cria o usuário `admin` com a senha `admin123` (só em
desenvolvimento) e um cliente de demonstração `cliente` / `cliente123`.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor com recarga automática (`node --watch`) usando `.env.development` |
| `npm start` | Servidor em modo normal (lê `.env`, se existir) |
| `npm test` | Testes da API e do banco (`node --test`, SQLite temporário) |
| `npm run test:firestore` | Os mesmos testes no emulador do Firestore + testes de transação e Storage |
| `npm run emulators` | Sobe os emuladores do Firestore e do Storage para usar com `npm run dev` |
| `npm run db:migrate` | Aplica migrações pendentes no banco SQL configurado |
| `npm run firestore:migrar` | Copia os dados do Supabase/SQLite para o Firestore (veja abaixo) |
| `npm run audit` | Auditoria de vulnerabilidades das dependências |

## Estrutura

```
server.js                  entrada: exporta o app (Vercel) ou escuta a porta
backend/
  app.js                   monta o Express: segurança, rotas, arquivos do site
  config.js                ambiente (.env via process.loadEnvFile)
  auth.js                  JWT, perfis (dono, gerente, caixa, cozinha) e permissões
  pricing.js               cálculo de preço no servidor (nunca confia no navegador)
  pix.js · mercadopago.js · storage.js   integrações
  http/
    errors.js              HttpError, handle() e tratamento central de erros
    security.js            CSP e cabeçalhos, limite de requisições
    validation.js          limpeza de texto, telefone, ids e imagens
  services/
    checkout.js            regras comuns a todo pedido (loja aberta, cliente, entrega)
    urls.js                URL pública do site
  routes/
    public.js              cardápio, dados da loja, acompanhamento de pedido
    auth.js                login, cadastro de cliente, sessão
    orders.js              pedidos, histórico do cliente, PDV
    payments.js            Pix, Mercado Pago e webhook
    catalog.js             produtos, adicionais, upload de imagens
    admin.js               clientes/CRM, funcionários, mesas, loja, caixa, estoque, relatórios
  db/
    index.js               API da camada de dados (require('./backend/db'))
    connection.js          SQLite (node:sqlite) ou Postgres, com run/get/all
    lifecycle.js           inicialização: migrações + dados iniciais
    migrate.js             executor de migrações versionadas
    migrations/            NNN_descricao.js — o esquema do banco
    seed.js                dados iniciais (só em tabelas vazias)
    repositories/          consultas por área (users, orders, products...)
public/                    site e painel (HTML/CSS/JS sem build) — veja docs/frontend.md
test/                      testes de API, segurança e banco
scripts/migrate.js         CLI do `npm run db:migrate`
```

## Como evoluir

### Nova tabela ou coluna

Crie `backend/db/migrations/005_minha_mudanca.js` (próximo número livre):

```js
async function up(ctx) {
  await ctx.exec(`
    CREATE TABLE IF NOT EXISTS cupons (
      id ${ctx.idColumn},
      codigo TEXT UNIQUE NOT NULL,
      desconto REAL NOT NULL DEFAULT 0
    )
  `);
  await ctx.addColumn('orders', 'cupom_id', 'INTEGER');
}
module.exports = { up };
```

A migração roda uma única vez por banco, dentro de uma transação, no próximo
boot ou com `npm run db:migrate`. As aplicadas ficam em `schema_migrations`.
`ctx.dialect` diz se é `sqlite` ou `postgres` quando o SQL precisar ser
diferente.

Regras que o executor confere sozinho:

- **Nunca edite uma migração já publicada: crie outra.** Cada migração
  aplicada guarda um checksum do arquivo, e o boot e o `npm run db:migrate`
  avisam quando o conteúdo mudou (a mudança não roda).
- **Tabela nova no Postgres precisa de RLS** (`ALTER TABLE ... ENABLE ROW
  LEVEL SECURITY` na própria migração). O executor avisa quando encontra
  tabela sem RLS, e desde a 004 tabela nova já nasce sem acesso pela API
  pública do Supabase.
- **Várias instâncias da Vercel ao mesmo tempo:** cada migração roda com uma
  trava de transação no Postgres (`pg_advisory_xact_lock`), segura também
  atrás do pooler do Supabase em modo transação (porta 6543). O
  `npm run db:migrate` usa o modo sessão (porta 5432) automaticamente.

### Nova consulta

Adicione a função no repositório da área em `backend/db/repositories/` e
exporte. Ela fica disponível em `require('./backend/db')`.

### Nova rota

Use `handle()` para ter a mensagem de erro padrão e lance `badRequest`,
`notFound` ou `conflict` para respostas ao usuário:

```js
router.get('/cupons', authMiddleware, requirePermission('produtos'),
  handle('Erro ao listar cupons.', async (req, res) => {
    res.json(await db.listarCupons());
  }));
```

Áreas novas ganham um arquivo em `backend/routes/`, registrado em
`backend/app.js`. Escreva o teste em `test/api.test.js`.

### Visual do site

Os tokens de design (cores, fontes, espaçamentos) e a organização do CSS e
do JavaScript compartilhado estão descritos em [docs/frontend.md](docs/frontend.md).

## Banco de dados

`backend/db/index.js` escolhe a implementação por `DB_PROVIDER`; as duas têm
**as mesmas funções e o mesmo formato de retorno**, então rotas e telas não
mudam:

| `DB_PROVIDER` | Implementação | Observações |
| --- | --- | --- |
| `firestore` | `backend/db/firestore/` | IDs numéricos por contador, itens dentro do pedido, CRM pré-calculado, transações para pedido/pagamento/caixa/estoque. Regras em `firestore.rules` (negam acesso direto; o backend usa o Admin SDK). Imagens no Cloud Storage. |
| `postgres` | `backend/db/repositories/` | Supabase, migrações versionadas e RLS |
| *(vazio)* | `backend/db/repositories/` | SQLite local para desenvolvimento |

Plano e decisões da troca para o Firebase: [docs/plano-migracao-firebase.md](docs/plano-migracao-firebase.md).

### Migrar os dados do Supabase para o Firestore

1. Crie `.env.migracao.local` (ignorado pelo git) com `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` (caminho do JSON
   da conta de serviço) e `SUPABASE_DB_URL`.
2. `npm run firestore:migrar -- --simular` lê a origem e mostra o que seria
   gravado, sem gravar nada.
3. `npm run firestore:migrar` grava e confere (pedidos, clientes,
   funcionários, produtos e faturamento iguais nos dois lados). Recusa gravar
   num Firestore que já tenha dados, a menos que receba `--substituir`.

O banco de origem só é lido. Feche a loja no painel durante a troca para não
entrarem pedidos no Supabase depois da cópia.

### Windows: emulador e pasta do usuário com espaço

Se o emulador falhar com `Unable to establish loopback connection`, aponte o
Java para uma pasta curta antes de rodar os testes:

```bash
set JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/Users/Public
```

## Deploy (Vercel)

1. Configure as variáveis de `.env.example` em *Settings → Environment
   Variables*: no mínimo `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD`,
   `PUBLIC_BASE_URL` e o banco (`DB_PROVIDER=firestore` com `FIREBASE_*`, ou
   `SUPABASE_DB_URL`).
   Roteiro da troca para o Firestore: seção 9 de
   [docs/plano-migracao-firebase.md](docs/plano-migracao-firebase.md).
2. O Node 26 é escolhido pelo campo `engines` do `package.json`, e as
   funções rodam em São Paulo (`regions: ["gru1"]` no `vercel.json`), perto
   do Firestore.
3. No Postgres, as migrações rodam sozinhas na primeira requisição de cada
   versão publicada (ou antes, com `npm run db:migrate`). No Firestore não há
   migrações: publique as regras com
   `npx firebase-tools deploy --only firestore:rules,storage --project <id>`.

## Segurança

Veja [SECURITY.md](SECURITY.md). Resumo: Dependabot, CodeQL e TruffleHog no
GitHub; CSP e cabeçalhos de segurança; limite de tentativas no login; preços e
pagamentos conferidos no servidor; RLS no Supabase.
