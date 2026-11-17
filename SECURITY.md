# Política de segurança

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use **Security → Report a vulnerability** neste
repositório no GitHub (relato privado). Se preferir, procure o mantenedor
diretamente.

Inclua, se possível: o que é afetado, os passos para reproduzir e o impacto
esperado. A resposta inicial deve sair em até 7 dias.

## Versões suportadas

Só a branch `main`, publicada na Vercel, recebe correções de segurança.

## O que já protege o projeto

| Camada | Proteção |
| --- | --- |
| Dependências | Dependabot (alertas e PRs semanais), `npm audit` no CI, Node 26 LTS |
| Código | CodeQL (`security-extended`) em todo push, PR e semanalmente |
| Segredos | TruffleHog no CI. Recomendado: ligar *Secret scanning* e *Push protection* nas configurações do repositório |
| HTTP | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, sem CORS aberto |
| Autenticação | JWT HS256 com segredo obrigatório fora do desenvolvimento, perfil conferido no banco a cada requisição, limite de tentativas de login |
| Pedidos e pagamentos | Preço calculado só no servidor, webhook do Mercado Pago com assinatura e conferência de valor |
| Banco | Consultas parametrizadas, migrações versionadas, RLS no Supabase |

## Configuração obrigatória em produção

Veja `.env.example`. Sem `JWT_SECRET`, o painel fica bloqueado de propósito.
Defina também `ADMIN_INITIAL_PASSWORD`, `PUBLIC_BASE_URL` e
`MERCADOPAGO_WEBHOOK_SECRET`.
