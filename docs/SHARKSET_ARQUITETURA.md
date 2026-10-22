# Arquitetura SHARKSET

## Fontes de verdade

- Firebase Auth identifica a conta pelo UID.
- `user_profiles/{uid}` contém perfil privado e saldo exibido; o saldo é escrito apenas por Functions.
- `token_orders/{orderId}` guarda pedidos do Mercado Pago; `user_profiles/{uid}/token_ledger/{entryId}` mantém créditos e débitos auditáveis.
- `arenas/{arenaId}` identifica dono e gestores. `tournaments/{tournamentId}` tem `tenantId` apontando para a arena, e partidas ficam em `tournaments/{id}/matches`.
- `academy_posts/{postId}` guarda materiais públicos com `publisherType` e `publisherId`. Mídia binária deve ficar no Cloud Storage ou no provedor de vídeo.
- `localStorage` é cache/preferência; ainda há domínios legados que precisam ser migrados antes de ser tratado como não autoritativo.

## Permissões

O administrador global é reconhecido pelo e-mail operacional legado, pelo custom claim `platformAdmin` ou por `admins/{uid}`. Donos e gestores de arena ficam limitados à arena associada. A assinatura libera operações premium por `arena_access/{uid}`. Usuário gratuito pode acompanhar o conteúdo público e compra tokens para criar campeonatos em arenas onde tem permissão.

## Token e campeonato

1. Cliente autenticado chama `createTournamentTokenCheckout`.
2. Function cria pedido no Firestore e preferência Checkout Pro a preço fixo de R$ 19,90 por token.
3. `mercadoPagoWebhook` valida `x-signature` e confirma o estado, moeda e valor na API Mercado Pago.
4. Uma transação credita o saldo uma vez e grava recibo e ledger.
5. `createArenaTournament` valida arena, papel e plano; grava campeonato e debita um token na mesma transação.

Nunca confiar no retorno do navegador como confirmação de pagamento.

## Publicação

As Functions estão na região `us-central1`. O Webhook do Mercado Pago usa URL direta do Cloud Functions. O site Hosting mantém rewrite `/api/**` para o serviço Express `sharkset-api` em `southamerica-east1`; esse serviço precisa existir antes do deploy do Hosting. O Express fornece agenda, diretório de transmissão e outras rotas ainda não substituídas por Functions.

## Cache e mídia

O shell e assets versionados podem ser cacheados. Consultas públicas usam caches curtos. Dados privados devem ser isolados por conta e não ficam persistidos offline por padrão. YouTube segue no player oficial: a aplicação pode atrasar a criação do iframe até a interação, mas não armazena o vídeo.

## Pendências

Reservas ainda não são criadas online, transmissão ainda pode começar sem uma partida vinculada, ranking tem partes locais/client-side e campeonatos ainda não foram migrados para subcoleções físicas da arena. Essas lacunas exigem uma migração compatível antes de afirmar consistência total multi-dispositivo.
