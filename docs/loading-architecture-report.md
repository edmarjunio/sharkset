# SharkSet — arquitetura de carregamento

Implementação local em 22/10/2026. Nenhum deploy foi realizado. Layout, identidade, mascote e motor esportivo foram preservados. A validação automatizada foi executada; a homologação completa em navegador e serviços reais permanece pendente.

## Evidências e prioridade

O projeto usa React 19, TypeScript, Vite 8/Rolldown, Zustand, Firebase Auth/Firestore, Express com SSE e Functions Gen 2. A navegação existente era feita por abas no AppContext, sem roteador. O Hosting publica dist e encaminha rotas para index.html. LiveKit/WebRTC e embeds do YouTube já estavam implementados; não foi introduzido HLS/DASH, Redis ou serviço pago.

| Gargalo observado | Tratamento |
|---|---|
| Telas de administração, agenda, ranking e tabela importadas na abertura | Módulos dinâmicos por tela e Suspense mantendo o shell |
| Logo de 5.543.214 bytes exibido em poucos pixels | Variantes PNG transparentes de 256 e 512 pixels, com hash e srcset |
| Cache de um ano para JS e imagens sem versão | Immutable apenas em /assets; HTML e worker revalidam; /brand com uma hora |
| Ranking consultado a cada montagem/alteração de atletas locais | Consulta compartilhada com TTL, deduplicação e invalidação por eventos oficiais |
| Agenda abre SSE por componente, faz polling e limpa os slots ao atualizar | Recurso por arena/data, retenção temporária da informação exibida e uma conexão compartilhada |
| Cada espectador da agenda abre três listeners no backend e provoca releituras periódicas | Três listeners compartilhados por arena/data/processo; projeção dos snapshots recebidos |
| Armazenamento local global misturava dados operacionais entre contas | Chaves privadas com UID, limpeza do estado na troca de conta e cache público com lista de campos permitidos |
| Probe de conexão Firestore em toda abertura | Removida a execução automática; consultas reais verificam conectividade |
| Erro de consulta retornava lista vazia como sucesso | Erro explícito; cache não é renovado por uma resposta que falhou |
| Edição de metadados de torneio era apenas local | Transação grava campos permitidos, consulta estado atual, rejeita finalizados e invalida catálogo |

## Medições reproduzíveis

Os valores exatos estão em loading-metrics.json e o baseline em loading-baseline.json. O baseline foi reconstruído do commit 13afb281c6afc3d48a3fa38c9fa1a0743ce015b9 com as mesmas dependências instaladas; o repositório estava limpo no início.

A medição soma apenas os arquivos JS referenciados por script/modulepreload no HTML de produção e calcula gzip de cada arquivo com Node. Não representa transferência total da página, tempo de execução, memória ou uma sessão de navegador.

| Indicador de build | Antes | Depois | Variação |
|---|---:|---:|---:|
| JS inicial sem compressão | 2.790.793 bytes | 1.119.689 bytes | -59.9% |
| JS inicial gzip, soma por arquivo | 769.127 bytes | 336.734 bytes | -56.2% |
| Arquivos JS referenciados na abertura | 7 | 24 | Mais arquivos; menos código inicial |

As variantes do logo têm 139.613 e 523.908 bytes. O navegador escolhe conforme tamanho e densidade; o original foi mantido. O número de arquivos JS iniciais aumentou com a divisão de código; não houve comprovação de redução no total de requisições de uma sessão. Os ícones foram agrupados para evitar um arquivo para cada ícone. Persistem chunks grandes do Firebase e LiveKit, que exigem acompanhamento em dispositivo real.

Não foram obtidos LCP, INP, CLS, TTFB, memória, buffering ou percentil 75 antes/depois. A navegação ao servidor local pelo navegador disponível terminou em timeout. O build continua avisando sobre uma referência preexistente a /brand/deep-ocean.jpg ausente; o fundo efetivamente utilizado pelo AquariumBackground é ocean-bg.jpg. Não houve substituição visual desse recurso nesta alteração.

## Política de dados e invalidação

| Recurso | Camada | Validade / atualização | Invalidação |
|---|---|---|---|
| JS/CSS/imagens com hash em /assets | HTTP e Service Worker | Cache First, immutable por um ano | Novo hash/build |
| HTML | HTTP e shell offline do worker | Rede primeiro; shell público offline | Revalidação e versão do build |
| Worker | HTTP | Sem cache prolongado | Registro de nova versão |
| Recursos mutáveis /brand | HTTP | Uma hora, com revalidação | Expiração/validação HTTP |
| Arenas | Memória compartilhada | Revalidação a cada 5 minutos enquanto visível; stale por até 30 minutos | Escritas locais, foco, reconexão e TTL |
| Projeção pública de arenas | localStorage | Cinco minutos desde a leitura bem-sucedida | Validade, versão ou nova leitura; erros não renovam a data |
| Metadados de campeonatos | Memória | Revalidação a cada 2 minutos; stale por até 10 minutos | Criação, edição, evento oficial, foco, reconexão e TTL |
| Ranking | Memória segregada pela sessão | 60 segundos; stale por até 5 minutos | Evento oficial, atualização manual, troca de conta e TTL |
| Agenda | Memória por arena/data + SSE | Snapshot a cada mudança e heartbeat de 30 segundos; HTTP de recuperação quando necessário | Eventos, refresh explícito, expiração e reconexão |
| Agenda sem consumidor | Memória | Retenção máxima de 2 minutos | Último consumidor fecha SSE e cancela requisição; depois elimina entrada |
| Listagem de lives | Memória por filtro/cursor | Dez segundos, limite de 32 entradas; falha não vira sucesso vazio | Expiração e filtro/cursor diferente |
| Preferências de visualização | Memória | Até 30 minutos e 80 entradas | Expiração; filtros da agenda separados por arena |
| Dados operacionais privados locais | Armazenamento por UID | Preservação dos registros da própria conta | Logout/troca de conta limpa estado visível; nunca confirma reserva/pagamento |

O recurso compartilhado deduplica requisições simultâneas, ignora respostas de gerações anteriores e impede uma resposta HTTP antiga de substituir um snapshot novo. As leituras revalidadas de catálogo/ranking usam getDocsFromServer para não renovar o TTL com cache offline do SDK.

Não foram criadas coleções de cache. Persistência automática de todo o Firestore foi desativada, pois pode armazenar perfis privados. A função explícita já existente continua disponível para uma futura experiência de dispositivo confiável; ela não é chamada no boot. O Service Worker não intercepta APIs, autenticação Firebase, pedidos com Authorization, operações de escrita ou mídia de terceiros.

Registros legados privados sem identificação de conta não são atribuídos automaticamente a quem entrar. As chaves antigas, exceto o antigo cache global de arenas, permanecem para revisão/migração. Dados de torneios/tabelas que existam somente no armazenamento legado precisam dessa revisão antes da liberação para usuários com histórico local. Snapshots antigos do navegador e mensagens fullMatches entre abas deixaram de substituir o estado oficial.

## Navegação e renderização

O shell, a barra de navegação e os componentes compartilhados permanecem montados. As abas possuem URL, histórico voltar/avançar, seleção de arena/campeonato e restauração de rolagem. Preferências públicas de filtros e modo de visualização sobrevivem à navegação. O pré-carregamento ocorre por intenção no menu e é evitado em saveData/2G. Não inicializa players.

A tabela conserva objetos de partidas não alteradas e o agrupamento por campeonato é memoizado. Consultas vazias também removem partidas antigas. O listener público por campeonato é compartilhado entre tabela e transmissão. O Context ainda é amplo: não foi comprovado via profiler que somente um card renderiza a cada evento. O pan/zoom interno da tabela não foi convertido em estado persistente entre todas as telas.

## Transmissões, notificações e audiência

O player LiveKit continua sob demanda e conserva adaptiveStream. Ao fechar, seus tracks são destacados e a Room é desconectada. O vídeo nativo solicita metadata e registra início/rebuffering no diagnóstico local. A tabela da transmissão é carregada somente quando aberta; alternar vídeo/tabela conserva o player existente. Não foi adicionado miniplayer ou protocolo novo.

Os eventos oficiais do campeonato usam inscrição compartilhada, histórico consultado com limite 20 e retenção local limitada a 40 entradas. O mecanismo existente de deduplicação foi preservado. Eventos novos invalidam ranking/catálogo. As regras de pontuação e geração da chave não foram alteradas.

Não foi encontrada uma agregação confiável e atualizada de espectadores por transmissão pronta para sustentar o destaque global. A contagem SSE da aplicação não equivale à audiência individual de uma live. Nenhuma contagem ou ranking de audiência foi inventado. Esse destaque ainda requer definir a métrica e integrá-la ao provedor; contagens antigas não foram usadas como nova agregação.

A interface ativa de fundo aquático já usa uma imagem estática. O canvas animado pertence à página de preview, cuja entrada de build foi mantida. Não houve remoção de mascote, animações ou efeitos; as regras existentes de reduced-motion foram preservadas. Não se mediu ganho de CPU/GPU.

## Reservas, pagamentos e segurança

A agenda é uma projeção pública sem nomes, telefones ou identificadores financeiros das reservas. O backend mantém /api/booking/checkout desativado com 503: não existe provedor operacional de reserva/pagamento nesse fluxo. Duas tentativas concorrentes são rejeitadas sem escrever reservas ou confirmar pagamentos fictícios. Isso testa o bloqueio seguro, não uma reserva transacional bem-sucedida.

A implementação não habilita pagamentos offline. A edição de metadados consulta o campeonato em transação e depende das regras existentes para autorizar o usuário e validar o documento. Essa gravação ainda precisa de teste no emulador com usuários/gestores reais. Não foram alteradas regras de acesso nem ampliadas permissões.

O código já possuía ranking consultado por ownerId, com limite de 100 atletas e ordenação local. Esse contrato foi preservado, compartilhado e invalidado. Não foi implementado um ranking global paginado ou um novo agregador oficial. Arenas e metadados de campeonatos ainda usam consultas completas; paginar esses catálogos exige adaptar busca e filtros existentes para não ocultar resultados. A economia líquida de leituras deve ser medida em produção: revalidação periódica acrescenta leituras em troca de atualização, enquanto deduplicação e compartilhamento removem leituras redundantes.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| npm run lint | Aprovado |
| npm run build | Aprovado; app, preview, manifest e worker gerados |
| npm --prefix functions run build | Aprovado |
| npm test | 78 aprovados de 79; um bloqueio de rede local no teste WhatsApp |
| npm --prefix functions test | 20 aprovados de 20 |
| Testes direcionados de carregamento e agenda | 16 aprovados de 16, incluídos na suíte principal |
| Referências privadas do chaveamento e testes de resultados | Aprovados nos testes locais, sem copiar conteúdo para a entrega |
| Dois espectadores na mesma agenda | Três inscrições compartilhadas; publicação não repete get() |
| Concorrência no checkout desativado | Respostas 503 sem escrita ou pagamento fictício |
| Vazamento por cache público/Service Worker | Verificado com projeção de campos, URLs e métodos excluídos |
| Troca de geração de consulta/conta | Resposta atrasada descartada |
| git ls-files technical_table | Nenhum arquivo versionado |

Duas fixtures preexistentes de Functions foram corrigidas: uma alterava apenas revision mantendo o mesmo resultado e esperava uma correção; outra declarava vencedor e perdedor como a mesma dupla no W.O. O validador de produção não foi flexibilizado.

O teste de WhatsApp falhou antes e depois com connect EACCES 127.0.0.1:<porta>. O teste foi mantido, sem ocultar a falha. A CLI Firebase retornou credenciais expiradas; não foi possível conferir edição/estado da instância ou métricas faturadas. Não foi realizado login em nome do usuário.

A homologação manual ainda deve cobrir desktop/mobile, rede lenta, primeira/segunda visita, login/logout e troca de conta, seleção de arenas/quadras, edições e cancelamentos, convites, permissões administrativas, partidas simultâneas, notificações, atualização entre abas após deploy, offline/reconexão e transmissão real. Pagamentos, estornos e concorrência de reservas bem-sucedidas exigem implementar/configurar o backend transacional ausente. Não se declara essa matriz integralmente aprovada.

## Diagnóstico e publicação

Os Core Web Vitals são coletados com web-vitals 4.2.4, já presente nas dependências transitivas e agora declarado diretamente. O diagnóstico é local, limitado a 100 amostras e sem envio remoto de URLs, IDs ou tokens. Pode ser consultado no console:

```js
window.__SHARKSET_PERFORMANCE__.read()
```

Inclui LCP, INP, CLS, FCP, TTFB, route-ready-ms, player-start-ms e livekit-track-attached-ms quando houver eventos compatíveis. O último mede anexação do track, não primeiro quadro decodificado. Eventos player-waiting e livekit-reconnecting são contagens de eventos, não duração de buffering. Percentil 75 exige amostra de campo por segmento/dispositivo; não foi calculado.

Para repetir a medição dos arquivos:

```powershell
npm run build
node scripts/measure-loading.mjs --baseline docs/loading-baseline.json --output docs/loading-metrics.json
```

Antes de publicar: renovar credenciais Firebase, conferir a instância (default), testar em staging/emuladores, revisar os registros locais legados e assegurar que /api/* chega ao backend Express. O firebase.json atual contém apenas o fallback SPA e não configura esse encaminhamento para Node/Cloud Run; VITE_LIVEKIT_API_BASE_URL cobre apenas a API LiveKit conforme configuração existente. Não foi inventado um serviço de destino.

A nova versão do worker espera o fechamento das abas antigas e não força recarga de arbitragem/player. Preservar assets das versões anteriores durante a transição é necessário para imports dinâmicos ainda não visitados por abas antigas. O ErrorBoundary existente permite recarga manual em caso de chunk indisponível. Homologar esse cenário antes da publicação.

Fontes consultadas: [persistência Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [build Vite](https://vite.dev/guide/build), [opções da Room LiveKit](https://docs.livekit.io/reference/client-sdk-js/interfaces/RoomOptions.html). As métricas e os resultados acima vêm dos arquivos e testes locais.

## Arquivos alterados/adicionados

- docs/loading-architecture-report.md
- docs/loading-baseline.json
- docs/loading-metrics.json
- firebase.json
- functions/tests/tournament-results.test.ts
- package-lock.json
- package.json
- scripts/measure-loading.mjs
- scripts/staticWorkerPlugin.ts
- server.ts
- server/bookings.ts
- src/App.tsx
- src/assets/brand/logo-256.png
- src/assets/brand/logo-512.png
- src/components/BroadcastWatchScreen.tsx
- src/components/ConnectionStatus.tsx
- src/components/CourtScheduler.tsx
- src/components/DoubleEliminationBracket.tsx
- src/components/FloatingBottomDock.tsx
- src/components/HomeHighlights.tsx
- src/components/LiveDirectory.tsx
- src/components/LivekitViewer.tsx
- src/components/Navbar.tsx
- src/components/RankingBoard.tsx
- src/components/SharksetLogo.tsx
- src/components/TournamentResultNotifications.tsx
- src/context/AppContext.tsx
- src/firebase-config.ts
- src/hooks/useArenaAvailability.ts
- src/hooks/useNavigationHistory.ts
- src/hooks/useRankingAthletes.ts
- src/hooks/useRememberedState.ts
- src/lib/firebase.ts
- src/main.tsx
- src/services/availabilityResources.ts
- src/services/catalogResources.ts
- src/services/livePageCache.ts
- src/services/performanceMetrics.ts
- src/services/publicArenaCache.ts
- src/services/queryResource.ts
- src/services/routeModules.ts
- src/services/serviceWorker.ts
- src/services/sharedSubscription.ts
- tests/bookingRoutes.test.ts
- tests/loadingArchitecture.test.ts
- tsconfig.json
- vite.config.ts
