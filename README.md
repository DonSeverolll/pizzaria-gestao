# PL Pizza — gestão de pizzaria

Cardápio público com pedidos online (dinheiro, Pix e cartão via Mercado Pago)
e painel administrativo com pedidos, PDV de balcão, produtos, estoque, mesas,
caixa, CRM, relatório de vendas, funcionários com perfis de acesso e
configurações da loja.

## Requisitos

- **Node.js 26 LTS** (versão fixada em `.nvmrc` e em `engines`)
- Nenhum banco para instalar no desenvolvimento: usa o SQLite embutido no Node
- Produção: Postgres/Supabase

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
| `npm run db:migrate` | Aplica migrações pendentes no banco configurado |
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

## Deploy (Vercel)

1. Configure as variáveis de `.env.example` em *Settings → Environment
   Variables* (no mínimo `JWT_SECRET`, `SUPABASE_DB_URL`,
   `ADMIN_INITIAL_PASSWORD`, `PUBLIC_BASE_URL`).
2. O Node 26 é escolhido pelo campo `engines` do `package.json`.
3. As migrações rodam sozinhas na primeira requisição de cada versão
   publicada. Para aplicar antes, rode `npm run db:migrate` apontando para o
   banco de produção.

## Segurança

Veja [SECURITY.md](SECURITY.md). Resumo: Dependabot, CodeQL e TruffleHog no
GitHub; CSP e cabeçalhos de segurança; limite de tentativas no login; preços e
pagamentos conferidos no servidor; RLS no Supabase.
