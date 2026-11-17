# Plano: migrar o banco do PL Pizza para o Firebase

Situação de hoje: Postgres/Supabase em produção e SQLite (embutido no Node) no
desenvolvimento e nos testes. Todo acesso ao banco passa por
`backend/db/repositories/` (58 funções em 8 arquivos, 13 tabelas). Rotas,
telas e regras de negócio só chamam essas funções, então **a troca fica
concentrada na camada de banco**.

---

## 1. Decisões antes de começar

| Decisão | Recomendação | Por quê |
| --- | --- | --- |
| Produto | **Cloud Firestore** (não o Realtime Database) | consultas com filtro e ordenação, índices, transações |
| IDs | **manter IDs numéricos** com um contador por coleção | a API e o front usam números (`/api/orders/12`, `Number(id)` no cálculo de preço e no carrinho); assim nada fora do banco muda |
| Login | **manter o login próprio** (JWT + bcrypt) | trocar para Firebase Auth é outro projeto (telas, sessões, perfis); pode vir depois |
| Imagens | **Cloud Storage do Firebase** no lugar do Supabase Storage | um provedor só, mesma credencial |
| Desenvolvimento e testes | **Emulador do Firebase** | os 28 testes atuais são de API e rodam iguais contra o emulador; exige Java instalado |
| SQLite local | **remover** depois da migração | manter duas implementações dobra a manutenção |

Pergunta que define a prioridade: **o que motivou a troca?** Custo, tempo
real (pedidos aparecendo na cozinha sem recarregar), familiaridade com o
Firebase ou problemas com o Supabase? A resposta muda o que vale fazer
primeiro (ex.: tempo real pede listeners no painel; custo pede atenção às
leituras dos relatórios, ver seção 5).

---

## 2. Modelo de dados (Firestore)

| Hoje (tabela) | Firestore | Observação |
| --- | --- | --- |
| `users` | `users/{id}` + `usernames/{username}` | o segundo garante login único (criado na mesma transação) |
| `customers` | `customers/{id}` + `customerLogins/{login}` | idem; `order_count` com `FieldValue.increment` |
| `menu_items` | `menuItems/{id}` | `size_prices` vira um mapa (hoje é JSON em texto) |
| `product_extras` | `extras/{id}` | |
| `tables` | `tables/{id}` | |
| `orders` + `order_items` | `orders/{id}` com **itens embutidos** (array) | some a tabela de itens e o "junta itens" do painel |
| `store_settings` | `settings/store` | um documento só |
| `store_hours` | `settings/hours` | array com os 7 dias |
| `cash_register` + `cash_movements` | `cashRegisters/{id}` + subcoleção `movements` | totais atualizados em transação |
| `inventory` + `inventory_movements` | `inventory/{id}` + subcoleção `movements` | o histórico passa a ser por id, não por nome |
| — (novo) | `counters/{coleção}` | próximo ID numérico |
| — (novo) | `crmCustomers/{chave}` | carteira do CRM pré-calculada (seção 5) |
| `schema_migrations` | — | Firestore não tem esquema; some junto com as migrações |

Datas passam a ser `Timestamp` do Firestore (hoje são texto em UTC).

---

## 3. O que muda no código

**Novo**
- `backend/db/firestore/`: uma implementação por repositório, com **as
  mesmas funções e o mesmo retorno** de hoje (`getOrders`, `createOrder`,
  `markOrderPaid`...). `backend/db/index.js` escolhe a implementação.
- `firebase-admin` como dependência; `firebase-tools` só para desenvolvimento
  (emulador).
- `firestore.rules`: **nega tudo**. O backend usa o Admin SDK, que não passa
  pelas regras; ninguém acessa o banco direto pelo navegador. É o equivalente
  ao RLS sem políticas que temos hoje.
- `firestore.indexes.json`: índices compostos para as consultas do painel
  (pedidos por data, por cliente, por telefone, por código, por referência de
  pagamento; cardápio por ativo + categoria + nome).
- Variáveis na Vercel: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`.

**Transações obrigatórias** (hoje são vários comandos SQL em sequência)
- Criar pedido: próximo ID + código `PL-XXXXXX` único + contador do cliente +
  CRM.
- Confirmar pagamento: só muda o status se ainda estiver "aguardando
  pagamento" (regra de segurança que já existe hoje).
- Movimento de caixa e de estoque: grava o movimento e atualiza o saldo
  juntos.
- Cadastro de funcionário e de cliente: login único.

**Sai**
- `pg`, conexão/pool do Supabase, `node:sqlite`, `backend/db/migrations/`,
  `migrate.js`, migração 003/004 (RLS), `npm run db:migrate`.
- `@supabase/supabase-js` (se as imagens forem para o Firebase).

**Não muda**
- Rotas da API, validações, preço calculado no servidor, webhook do Mercado
  Pago, login, telas da loja e do painel.

---

## 4. Testes e CI

- Os 28 testes atuais (API e segurança) rodam contra o **emulador do
  Firestore** sem reescrever as verificações: só muda como o banco é
  preparado e limpo entre os testes.
- Os testes de banco que olham `schema_migrations` e índices SQL saem e
  entram testes de transação (pedido duplicado, pagamento confirmado duas
  vezes, login repetido).
- CI: instalar Java e rodar `firebase emulators:exec "npm test"`.

---

## 5. Custo e desempenho (o ponto de atenção)

O Firestore cobra **por documento lido e gravado**. Hoje duas telas leem a
base inteira a cada abertura:

- **CRM**: lê todos os pedidos e clientes para montar a carteira. No
  Firestore isso vira `crmCustomers/{chave}`, atualizado a cada pedido
  (uma leitura por cliente na tela, não por pedido).
- **Relatório de lucro**: lê os pedidos do período. Aceitável para "hoje" e
  "7 dias"; para "mês" e períodos longos, guardar totais por dia em
  `stats/{AAAA-MM-DD}`.

Com o volume de uma pizzaria, o plano gratuito (Spark) costuma bastar no
começo, mas o webhook e o painel aberto o dia todo somam leituras; vale
ligar alerta de orçamento no Google Cloud.

Também: a função na Vercel fica um pouco mais pesada no primeiro acesso
(`firebase-admin` é maior que o `pg`).

---

## 6. Migração dos dados atuais

- `scripts/migrar-para-firestore.js` (`npm run firestore:migrar`): lê do
  Postgres atual (ou de um SQLite) e grava no Firestore em lotes (até 500
  gravações por lote), **mantendo os IDs**.
- Modo `--simular` (só conta e valida, não grava) e conferência no fim
  (quantidade de pedidos, clientes, produtos e soma do faturamento iguais
  nos dois lados).
- Janela de troca: marcar a loja como fechada no painel, migrar, publicar a
  versão com Firestore, conferir e reabrir. O Supabase fica intacto (só
  leitura) por alguns dias para voltar atrás se precisar.

---

## 7. Ordem de execução

1. Criar o projeto no Firebase, a conta de serviço e configurar o emulador
   local.
2. Implementar os repositórios no Firestore, um por vez, rodando os testes
   no emulador a cada um.
3. Imagens no Cloud Storage do Firebase.
4. Regras de segurança e índices; publicar no projeto Firebase.
5. Script de migração; rodar em modo simulação com uma cópia dos dados.
6. Deploy de prévia na Vercel apontando para o Firestore; teste completo de
   pedido, Pix, cartão, caixa e relatórios.
7. Janela de troca em produção (seção 6).
8. Limpeza: remover Postgres, SQLite, migrações e Supabase do código e da
   documentação.

---

## 8. Riscos

| Risco | Como tratar |
| --- | --- |
| Custo crescer com leituras | CRM e totais pré-calculados; alerta de orçamento |
| Perder a garantia de "um pagamento confirma uma vez" | transação com checagem de status (seção 3) e teste dedicado |
| IDs numéricos em concorrência | contador em transação; volume de pizzaria não gera disputa relevante |
| Emulador exige Java | instruções no README; no CI, `setup-java` |
| Dependência de um fornecedor | a camada de repositórios continua isolando o banco do resto do app |
| Fuso horário dos relatórios | gravar sempre em UTC (`Timestamp`) e converter só na exibição |

---

## 9. Situação e roteiro da troca em produção

**Já feito (17/11/2026)**
- Projeto Firebase `plpizza-ebc69` (plano Spark), banco Firestore `(default)`
  em `southamerica-east1` (São Paulo), modo produção (regras negam tudo).
- O Supabase estava pausado; os dados vieram do backup
  `db_cluster-29-09-2026` (carregado num SQLite temporário e migrado com
  `npm run firestore:migrar`). Conferência: 9 pedidos, 2 clientes,
  2 funcionários, 3 produtos e R$ 411,90 iguais nos dois lados.
- Imagens: o Storage do Firebase exige o plano Blaze, então ainda não há
  bucket. Os produtos usam links externos; o logo apontava para o Supabase
  (fora do ar) e a loja cai no logo padrão (`/logo-pl-real.png`).
- `vercel.json` com `"regions": ["gru1"]`: as funções rodam em São Paulo,
  ao lado do banco.

**Roteiro**
1. Fazer o merge do PR da base v2 e depois o do Firestore.
2. Na Vercel, *Settings → Environment Variables*, **só no ambiente
   Production** (prévias de PR não devem gravar no banco real):
   | Variável | Valor |
   | --- | --- |
   | `DB_PROVIDER` | `firestore` |
   | `FIREBASE_PROJECT_ID` | `plpizza-ebc69` |
   | `FIREBASE_CLIENT_EMAIL` | campo `client_email` do JSON da conta de serviço |
   | `FIREBASE_PRIVATE_KEY` | campo `private_key` do JSON (pode colar com quebras de linha ou com `\n`) |
   | `STORAGE_PROVIDER` | deixar vazio enquanto não houver bucket |

   `JWT_SECRET`, `PUBLIC_BASE_URL` e as do Mercado Pago continuam como estão.
   Para copiar a chave sem abrir o arquivo (PowerShell):
   `(Get-Content '<arquivo-da-chave>.json' -Raw | ConvertFrom-Json).private_key | Set-Clipboard`
3. *Deployments → Redeploy* da produção (variável nova só vale a partir do
   próximo deploy).
4. Conferir no site publicado: cardápio com os 3 produtos, acompanhamento de
   um pedido pelo código, login no painel, relatório de vendas.
5. No painel, *Configurações*: enviar o logo de novo ou colar a URL de uma
   imagem (o upload responde pedindo o bucket enquanto não houver Storage).
6. Depois de alguns dias estável: tirar `SUPABASE_*` da Vercel e, na limpeza
   (seção 7, passo 8), o Postgres do código.
