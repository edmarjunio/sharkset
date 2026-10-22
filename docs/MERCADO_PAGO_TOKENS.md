# Tokens de campeonato via Mercado Pago

## Valores

- 1 token: R$ 19,90
- 5 tokens: R$ 99,50
- 10 tokens: R$ 199,00

Não há desconto por pacote. Cada token pago dá direito a criar um campeonato em uma arena na qual a conta tenha permissão.

## Configuração das chaves

No terminal, na pasta do projeto:

```powershell
firebase use sharkset-70de4
firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_SECRET
```

Cole o Access Token da aplicação do Mercado Pago no primeiro prompt e a chave secreta de Webhooks no segundo. Não coloque esses valores em `.env`, `VITE_*`, no código do navegador ou no Git.

## Webhook

Configure a notificação de pagamento da aplicação Mercado Pago para:

```text
https://us-central1-sharkset-70de4.cloudfunctions.net/mercadoPagoWebhook
```

Selecione eventos de pagamentos. O servidor valida `x-signature`, consulta o pagamento pela API oficial, confere valor/moeda/pedido e só então credita os tokens. Repetições de webhook não duplicam saldo.

## Publicação

Depois de cadastrar os dois secrets:

```powershell
firebase deploy --only firestore:rules,functions
```

O checkout está configurado para retornar ao site `https://sharkset.web.app`. Depois do deploy, faça uma compra de teste com uma conta de comprador de teste, confirme que o Mercado Pago mostra pagamento aprovado e que o saldo mudou no perfil. Não credite tokens manualmente no navegador.

## Fluxo técnico

1. O cliente chama `createTournamentTokenCheckout` com a quantidade.
2. A função grava um pedido pendente e cria uma preferência Checkout Pro com preço fixo definido no servidor.
3. O comprador conclui o pagamento no Mercado Pago.
4. `mercadoPagoWebhook` valida a assinatura e confirma o pagamento consultando `/v1/payments/{id}`.
5. Uma transação grava recibo, atualiza saldo e cria o lançamento imutável do histórico.
6. `createArenaTournament` cria o campeonato e, se necessário, consome um token na mesma transação.

