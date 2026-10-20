# LiveKit: arquitetura, segurança e homologação

## Resultado e limites da execução

Integração preparada para `sharkset-70de4`, sem deploy, ativação de APIs, alteração de plano ou acesso ao conteúdo dos secrets. O projeto Firebase local e `.firebaserc` correspondem ao esperado. Em uma sessão anterior, o `gcloud` apontou para um projeto diferente do SHARKSET e as consultas de metadados falharam por acesso negado à configuração de credenciais local. Portanto, **existência/versões dos secrets, faturamento remoto e IAM aplicado continuam não confirmados**. Não copiar credenciais de outro projeto para contornar isso.

Há alterações locais anteriores em ArenasDirectory, FreeSlotsDateTimeFilter, tenants e cache do Hosting; foram preservadas. Nenhum motor de campeonato, tabela ou ranking foi alterado.

## Arquitetura encontrada

- React/Vite com Firebase Authentication (Google) e Firestore no cliente.
- Express em `server.ts`, normalmente na porta 369; Firebase Admin com credenciais padrão.
- Hosting estático em `firebase.json`, sem execução do Express em produção. O fallback da SPA não constitui backend.
- Transmissões existentes: URLs HTTPS/YouTube, painel livre, estúdio local de reservas e tela imersiva de público.
- `arenas/{arenaId}.ownerId` é a referência de propriedade no servidor. Os cadastros locais e o perfil visual do aplicativo não comprovam autorização.

## Arquitetura preparada

1. `livekitSession` (Functions Gen 2 / Node 22): Firebase ID token verificado com checagem de revogação; autorização pelo ownerId ou `arena_members/{arenaId}/users/{uid}` com `active: true` e papel `owner`/`manager`. Esses vínculos só podem ser provisionados por administração confiável; as regras atuais negam escrita pelo navegador.
2. Tokens oficiais LiveKit de dois minutos, escopo de uma sala: gestor publica apenas câmera/microfone, sem dados nem administração; espectador autenticado apenas assiste. Tokens ficam em memória e nunca no Firestore, URL, logs ou localStorage.
3. Uma sessão ativa por arena, reservada em transação, com nomes de sala e identidades únicos por geração. Pedidos paralelos recebem conflito.
4. O navegador solicita câmera/microfone, conecta e publica as faixas. Só a confirmação servidor-servidor de uma câmera ativa altera `isLive` para verdadeiro.
5. Confirmação periódica a cada 20 segundos renova uma validade de anúncio de 90 segundos. Sem confirmação, a consulta e o player deixam de aceitar a sessão. O servidor também confirma a câmera antes de gerar cada token de espectador.
6. `livekitDirectory`: nenhuma credencial LiveKit; lê lotes de até 12 registros, filtra localização da arena e exclui anúncios vencidos. A lista existente de URLs/YouTube continua compatível.
7. `livekitWebhook`: somente chave/secret de assinatura. Validação oficial sobre os bytes originais e Authorization, recibos idempotentes, proteção contra eventos antigos e salas substituídas. Saída de espectador não encerra live; saída de gestor, retirada da câmera e encerramento de sala retiram o anúncio.
8. Encerramento: primeiro bloqueia novos tokens e retira o anúncio; depois remove/revoga o publicador e exclui a sala. Falha na exclusão exige repetição e não retorna sucesso falso. Tracks locais são paradas mesmo com falha de rede. Sessão anterior pode ser recuperada para encerramento após recarregar a página.
9. LIVEKIT_URL é usado exclusivamente no servidor. A API **não retorna seu valor**. O cliente exige um endereço WebRTC público configurado separadamente em `VITE_LIVEKIT_PUBLIC_URL`. Este endereço será necessariamente visível na conexão de rede; ele não é chave privada. Não extrair esse valor do Secret Manager para preenchê-lo automaticamente.

Não há gravação, egress, transcodificação, criação de ingress nem pontos de ranking nesta integração.

## Identidades e acesso mínimo

| Função | Conta de execução | Secrets vinculados |
|---|---|---|
| livekitSession | livekit-session | LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL |
| livekitWebhook | livekit-webhook | LIVEKIT_API_KEY, LIVEKIT_API_SECRET |
| livekitDirectory | livekit-directory | nenhum |
| API Gateway | livekit-gateway | nenhum |

As contas usam `@sharkset-70de4.iam.gserviceaccount.com`. `defineSecret` aparece somente nas Functions, com bindings explícitos. `prepare-livekit-iam.ps1` prepara contas e papéis personalizados para as operações Firestore necessárias; apenas a conta de sessão pode consultar usuários Auth. Secret Accessor é concedido **por secret**, jamais no projeto inteiro. Nenhuma conta recebe Owner/Editor, chave JSON ou acesso de todos os usuários. As permissões Firestore do Admin SDK são IAM, não regras de cliente; os papéis preparados têm alcance do projeto para operações de documentos e não constituem isolamento por coleção. Para isolamento IAM também por banco, a evolução recomendada é um banco dedicado às lives, com avaliação de custos e migração separada.

Para não tornar Functions públicas no IAM, somente a identidade livekit-gateway consta em `invoker`. `infra/livekit/gateway.openapi.json` prepara um Gateway que valida o JWT Firebase nas operações de sessão. O Gateway preserva o bearer original em X-Forwarded-Authorization; o backend volta a validá-lo e verifica a arena. Webhook e listagem são alcançáveis pela borda, mas o webhook só aceita assinatura LiveKit válida. O Gateway não lê secrets e não executa mídia. Nenhuma infraestrutura remota foi criada.

O deployer precisará de actAs nas contas específicas. Não ampliar permissões do usuário ou do projeto automaticamente para resolver erros de implantação.

## Custos e riscos — antes de qualquer autorização de publicação

- Cloud Functions exige Blaze para publicação; se ainda estiver em Spark, será necessário migrar. O estado remoto atual **não foi confirmado**.
- Blaze tem franquias, não é garantia de custo zero. Execução, leituras/escritas Firestore, build, Artifact Registry, saída de rede e armazenamento podem cobrar. `minInstances: 0`, `maxInstances: 2`, timeout de 30 s e 256 MiB limitam parte da infraestrutura; não são um teto financeiro.
- Secret Manager: franquia de seis versões ativas e 10 mil acessos mensais; excedentes de acesso a US$ 0,03/10 mil. Rotacionar mantendo poucas versões ativas.
- API Gateway: até 2 milhões de chamadas/mês por conta de faturamento sem cobrança de chamadas; depois US$ 3/milhão na faixa seguinte, mais tráfego aplicável.
- LiveKit Build: US$ 0/mês, 5 mil minutos WebRTC, 50 GB downstream e 100 conexões simultâneas na tabela consultada. Ship: a partir de US$ 50/mês, 150 mil minutos e 250 GB; excedentes indicados de US$ 0,0005/min e US$ 0,12/GB.
- Uma hora com um gestor e 100 espectadores = 6.060 minutos de conexão. Aproximadamente 100 espectadores a 1,5 Mbps por uma hora = 67,5 GB, sem contar overhead. É estimativa; o bitrate adaptativo varia. A sala está limitada a 51 participantes nesta preparação, e o plano Build possui limite global de 100.
- Definir alertas de orçamento, limites no LiveKit, distribuição por região e política de abuso antes de liberar publicamente. Não enviar vídeo pelas Functions.
- Reconexão e remoção de participante dependem do comportamento do LiveKit Cloud/versão do servidor. Tokens curtos reduzem risco, mas revogação em self-hosted deve ser homologada: não assumir equivalência com Cloud.
- As origens CORS incluem Hosting oficial e localhost; incluir apenas as origens reais autorizadas de homologação. Não liberar wildcard.

Fontes oficiais consultadas em 20/10/2026 UTC:
https://firebase.google.com/pricing
https://firebase.google.com/docs/functions/config-env
https://cloud.google.com/secret-manager/pricing
https://cloud.google.com/api-gateway/pricing
https://livekit.com/pricing
https://docs.livekit.io/home/server/generating-tokens
https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/
https://docs.cloud.google.com/api-gateway/docs/oasv2-extensions

## Preparação local segura

1. Não executar `functions:secrets:access`, `gcloud secrets versions access`, exports de secrets ou criação de arquivos de chave.
2. Usar Node 22 para aproximar o runtime escolhido. A máquina atual tem Node 24; os testes disponíveis foram executados nesse runtime local.
3. `npm ci` na raiz; `npm --prefix functions ci`; `npm --prefix functions run build`; `npm --prefix functions test`.
4. O ambiente atual não forneceu Java nem Docker no PATH. O emulador Firestore e um servidor LiveKit local não foram executados. Os testes de serviço usam Firestore e transporte em memória, mas o SDK oficial real para assinar/verificar tokens e webhooks.
5. Ao usar emuladores futuramente, utilizar **somente credenciais locais sintéticas** em `functions/.secret.local` (arquivo ignorado), nunca valores de produção. Sem esse arquivo o emulador pode tentar acessar Secret Manager: não iniciar nessa condição. Usar um projeto demo separado, adaptando a proteção de projeto apenas em um harness de teste isolado, ou o projeto esperado sem credenciais de produção e com todos os emuladores explicitamente configurados.
6. `LIVEKIT_EMULATOR_PROXY=true` habilita no Express apenas o encaminhamento para 127.0.0.1:5001. Não é usado em produção. Não expor os emuladores na internet.
7. `VITE_LIVEKIT_ENABLED=false` permanece padrão. Antes da homologação preencher somente o endereço público da API Gateway e a URL WebRTC pública em configuração local não versionada; nenhum VITE contém chave privada.

## Etapas remotas preparadas, ainda não executadas

- Corrigir a autenticação/configuração do gcloud na sessão do responsável, sem copiar a configuração de outro projeto. Executar `./scripts/audit-livekit-cloud.ps1`: apenas metadados de projeto, billing e versões habilitadas.
- Revisar `./scripts/prepare-livekit-iam.ps1` em dry-run. O modo `-Apply` altera IAM e só deve ser usado no projeto confirmado, após revisão pelo responsável. Não faz deploy, não habilita APIs e não altera billing.
- Após autorização de custos/Blaze, preparar as APIs necessárias, criar as contas e permissões, publicar somente o codebase LiveKit, criar o Gateway com a especificação incluída e a conta backend livekit-gateway. Não usar allUsers nas funções/secrets. As etapas de deployment são propositalmente externas ao script IAM.
- No LiveKit Cloud, configurar a URL HTTPS pública `/api/livekit/webhook` do Gateway. Marcar os eventos de saída de participante, track_unpublished e room_finished. Não cadastrar uma URL privada da função diretamente no webhook.
- Provisionar uma arena de homologação **real no Firestore**, com ownerId igual ao UID Firebase do gestor. Vínculos de gestor são provisionados administrativamente; nunca aceitar papel/arena informado pelo navegador como autorização.
- Habilitar TTL, após revisão de retenção e custos, em `livekit_rate.expiresAt` e `livekit_events.expiresAt`, e limpeza/retencão das salas finalizadas. Não há tarefa agendada automática nem custo de Scheduler nesta proposta.
- Ajustar build público com VITE_LIVEKIT_ENABLED=true, endereço do Gateway e endereço WebRTC público; publicar frontend só após autorização.

## Homologação entre dois dispositivos

| Passo | Dispositivo A — gestor | Dispositivo B — espectador | Resultado esperado |
|---|---|---|---|
| 1 | Login Google dono da arena de teste | Login de outro usuário | Ambos autenticados; B não consegue publicar |
| 2 | Arena → Transmissões → Iniciar transmissão; permitir câmera/microfone | Abrir LIVE | Ainda não aparece durante starting |
| 3 | Publicação e confirmação do backend | Atualizar LIVE / abrir arena | Vídeo e áudio recebidos; nenhuma chave privada no navegador |
| 4 | Manter live | Ativar áudio, expandir, tabela, voltar | Reprodução preservada; viewer token sem permissão de publicação |
| 5 | Negar câmera/mic em nova tentativa | Consultar listagem | Sem falso anúncio e sem indicador de câmera ativo após cancelar |
| 6 | Interromper rede e restaurar | Acompanhar aviso de conexão | Reconexão ou retirada por confirmação/lease; nenhuma live fantasma permanente |
| 7 | Encerrar transmissão | Observar player e lista | Novo token negado, câmera/microfone desligados, anúncio removido |
| 8 | Repetir encerramento e reproduzir webhook duplicado | Tentar publicar usando token viewer | Idempotência e rejeição de publicação |
| 9 | Iniciar nova sessão | Reenviar evento assinado antigo da sala anterior no harness de teste | A sala nova permanece independente |

O teste real A/B permanece pendente: exige infraestrutura de homologação autorizada, projeto remoto confirmado e interação física com câmera/microfone. Não foi realizado nem anunciado como sucesso.

## Limitações existentes fora do escopo

A checagem TypeScript geral encontrou referências não declaradas no fluxo de criação de torneio (`setShowCreateModal`, `showCreateModal`, `renderCreateTournamentModal`), campos sets1/sets2 ausentes no tipo BracketMatch usado pelo overlay existente e campos obrigatórios ausentes em EMPTY_TENANT. Não foram alterados para respeitar a restrição sobre campeonatos e mudanças concorrentes. Ver o relatório final da execução para resultados efetivos de build/testes.

## Condição de protocolo que exige aceite antes de emitir tokens reais

O SDK oficial coloca a API key em `iss` no JWT. Esse campo é decodificável no navegador; armazenar a key no Secret Manager não oculta o identificador dentro do token. A assinatura mantém o API_SECRET fora do cliente. O protocolo não oferece um JWT de entrada compatível que esconda também o issuer.

Para respeitar a instrução de não expor os valores dos secrets, a emissão real nas funções `start` e `viewer` fica **bloqueada por padrão** pelo parâmetro não secreto `LIVEKIT_ALLOW_JWT_ISSUER_DISCLOSURE=false`. Só configurar `true` após o responsável aceitar explicitamente que o identificador da API key aparecerá no JWT restrito, de curta duração. Não existe valor real no código e não foi gerado token de produção. O SDK cliente continua dependendo do endereço WebRTC público configurado separadamente; o backend não retorna LIVEKIT_URL.

Seleção de projeto após a orientação do responsável: o comando gcloud com override de sessão confirmou `sharkset-70de4`. `scripts/use-sharkset.ps1` configura os overrides de projeto na sessão (`. ./scripts/use-sharkset.ps1`); não copia ou modifica o armazenamento de credenciais local. O acesso remoto aos metadados continua pendente por permissão da configuração local.

## Verificações executadas nesta alteração

- 54 testes existentes aprovados, preservando o motor de campeonatos.
- 16 testes novos de LiveKit aprovados: grants pelo SDK real, ownership/membership, limite de sessão, câmera confirmada, falhas de provedor, stop idempotente/repetível, assinatura sobre corpo bruto, deduplicação, eventos antigos, SID anterior após reconexão, expiração, rate limit, projeção pública, autenticação HTTP, bloqueio de issuer e manifest Gen 2/IAM/secrets.
- Compilação TypeScript das Functions aprovada.
- Build Vite aprovado. LiveKit é carregado sob demanda em chunks separados, preservando a carga inicial do site; permanece aviso de bundles grandes.
- TypeScript global do frontend ainda reprovado pelos problemas existentes descritos acima; a última execução também detectou erros de tipos em MyBookings, modificado em paralelo. Nenhum desses módulos de negócio foi alterado nesta integração.
- Não há confirmação remota de versões dos secrets, IAM aplicado, plano atual ou webhook cadastrado. Não houve geração de tokens de produção, acesso ao payload de secrets, câmera real, deploy ou faturamento habilitado.
