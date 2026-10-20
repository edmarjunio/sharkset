# Cache e notificações de arenas

A inicialização única fica em `src/firebase-config.ts`. IndexedDB com várias abas é configurado antes de qualquer consulta; navegadores sem IndexedDB usam memória. `src/services/db.ts` aplica GET_SERVER_CACHE: tenta a persistência primeiro, limita a validade das leituras e compartilha requisições simultâneas. Arenas têm validade de cinco minutos, torneios de um minuto e agendas de 30 segundos. Erros de permissão são propagados; falhas transitórias podem recuperar dados antigos, identificados como offline. Horários offline ficam indisponíveis para compra. A disponibilidade e o preço devem ser confirmados pelo servidor no checkout.

A agenda continua recebendo a projeção validada da API por SSE. Enquanto a conexão está ativa não há polling do navegador; o heartbeat do servidor não relê o Firestore. Consultas de fallback não fabricam disponibilidade após falha de rede.

## Fontes e implantação

Os dados oficiais continuam em `arenas`, `bookings`, `booking_blocks` e `tournaments`. Os gatilhos geram `arenas_public`, `arena_schedules` e `tournaments_public` com campos permitidos explicitamente. Documentos de agendamento públicos contêm ocupação e bloqueios, sem identidade de clientes, meios de pagamento ou contatos pessoais. Regras permitem leitura pública dessas projeções e proíbem gravações do navegador. As regras existentes dos documentos privados continuam aplicadas.

1. Configure `VITE_FIREBASE_VAPID_KEY` com a chave pública Web Push do projeto antes do build. Habilite a FCM Registration API e use HTTPS (localhost também é aceito para desenvolvimento).
2. Configure `NOTIFICATION_SITE_ORIGIN` com a origem HTTPS exata do aplicativo. Os clientes recusam links de outra origem.
3. Publique as regras e as funções de `functions/src/arenaEvents.ts`. Os exports pertencem ao codebase `livekit` já existente em `firebase.json`; podem ser implantados individualmente sem alterar os serviços de LiveKit. Os gatilhos utilizam o database indicado por `FIRESTORE_DATABASE_ID`, ou `(default)`; essa variável deve estar definida também no ambiente da CLI durante a implantação quando um database nomeado for utilizado. A conta de serviço precisa de acesso ao Firestore e envio FCM.
4. Leia o catálogo atual em modo de simulação: `npx tsx scripts/backfill-public-catalog.ts`. Para criar as projeções de registros existentes, execute com `--apply`. Essa migração exige credenciais administrativas do projeto SHARKSET e não dispara avisos históricos. Ela não foi executada automaticamente.
5. Faça build do frontend e implante o hosting junto com as funções/regras. A chave pública é incorporada no build. O service worker é empacotado pelo Vite e registrado no escopo do diretório gerado, sem dependências remotas.

As projeções de novos dias surgem quando há uma alteração naquela data ou uma alteração na arena. Se ainda não houver projeção para uma data, a agenda consulta a API existente; não presume que o dia esteja vazio. Para manter todo o horizonte disponível offline, a sincronização pode ser repetida diariamente pela infraestrutura existente.

## WhatsApp

Use o Secret Manager para `WHATSAPP_ACCESS_TOKEN` e configure `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_BOOKING_CANCELLED_TEMPLATE` e `WHATSAPP_TOURNAMENT_OPENED_TEMPLATE` nos parâmetros das Functions. A versão Graph deve ser uma versão vigente suportada pela conta, no formato `vN.N`.

O export `sendArenaWhatsApp` requer o segredo; omita esse export da implantação até a conta estar configurada. Push usa o export independente `sendArenaPush`, que não exige segredo de WhatsApp.

Os dois modelos devem estar aprovados pela Meta em `pt_BR`, com dois parâmetros no corpo: (1) texto do aviso; (2) URL completa. O telefone é informado pelo titular da conta em formato internacional, com país e DDD. Somente preferências com consentimento explícito habilitam o envio. Nenhum envio real foi realizado durante a implementação.

## Fluxo e idempotência

O usuário entra com conta verificada, abre o perfil, seleciona arenas favoritas, habilita eventos e ativa push neste dispositivo e/ou autoriza WhatsApp. Cada navegador registra um token privado. O botão de ativação também renova o registro. Logout remove o token do dispositivo; tokens invalidados pelo FCM são excluídos. A revogação das preferências é conferida novamente imediatamente antes do envio.

Uma reserva passa de `confirmed` ou `pending` para `cancelled` no Firestore: o titular da reserva e os usuários que favoritaram a arena recebem avisos distintos. Quando um torneio passa para `isOpenForRegistration: true` e ainda não terminou, os seguidores recebem o aviso de inscrições. A primeira abertura é anunciada uma vez por ID de torneio. A criação de torneios fora do modo de demonstração aguarda a confirmação da gravação no Firestore, com validação de organizador nas regras, antes de anunciar sucesso. Submissões simultâneas no mesmo aplicativo são bloqueadas. Fluxos de demonstração e alterações apenas em localStorage não geram eventos externos. Cancelamentos precisam ser confirmados por um processo administrativo no servidor; o aplicativo ainda orienta o usuário a contatar a arena para cancelar.

`notification_events` registra o evento e `notification_jobs` registra cada destinatário/canal/dispositivo com ID determinístico. A criação é transacional. O envio confere o registro oficial, o consentimento e a situação atual antes de chamar o provedor. Estados: `queued`, `sending`, `accepted`, `skipped`, `not_configured`, `failed`, `unknown_delivery`. `accepted` significa aceito pelo provedor, não comprovadamente recebido. Falhas incertas e processos interrompidos em `sending` não são reenviados automaticamente: não é possível garantir entrega exatamente uma vez entre Firestore e provedores externos. A equipe deve revisar esses estados, sem repetir envios às cegas.

Os links de reserva incluem arena, quadra, data, horário e intenção `payment=pix`; a tela consulta novamente a disponibilidade. Links de torneios carregam o catálogo público e abrem a seção de campeonatos da arena.

**Pix ainda depende de integração com provedor e confirmação de pagamento por webhook.** O checkout existente responde indisponível e continua assim; o sistema não cria cobrança, não confirma reserva nem afirma que houve pagamento. Não se deve anunciar pagamento Pix instantâneo antes dessa integração.

## Validação

`npm test`, `npm run build`, `npm --prefix functions run build`. Testes específicos: `node --import tsx --test tests/cacheNotifications.test.ts`. A entrega real FCM/WhatsApp exige configuração dos provedores e um dispositivo de teste com consentimento. As regras precisam ser exercitadas no emulador antes de implantação; o ambiente de desenvolvimento desta mudança não dispõe de Java/emulador Firestore.

