# Agendamentos — implementação e configuração

## Comportamento entregue

- A página inicial apresenta horários disponíveis, transmissões publicadas ao vivo, arenas e campeonatos, nessa ordem.
- A data é compartilhada entre a página inicial, o diretório, a agenda da arena e a revisão do horário. O seletor oferece hoje e os próximos seis dias; a agenda da arena respeita também o limite retornado pelo servidor.
- O horário é opcional, inicia vazio e filtra pelo início exato quando preenchido.
- A faixa no topo agrupa arenas próximas e, dentro delas, horários por quadra. O cartão abre a página da arena; cada horário livre abre sua revisão de pagamento. Os controles são independentes.
- A agenda distingue livre, reservado, aula, bloqueado e indisponível. O diálogo nativo oferece fechamento por Escape e contenção de foco.
- A disponibilidade considera intervalos sobrepostos, arena, quadra, data, aulas recorrentes, bloqueios, preços por dia e reservas pendentes válidas. A consulta pública não contém nomes de clientes, telefones ou identificadores de pagamento.
- A localização é solicitada por ação do usuário na página inicial. Quando indisponível, a interface identifica as distâncias de referência.

## Pagamentos e reservas: pendências deliberadas

Não havia provedor de pagamentos verificável integrado ao checkout encontrado. O PIX fictício e a confirmação por clique foram removidos. O checkout apresenta a revisão do horário e, quando possível, um link para consultar a arena; não registra uma reserva nem informa pagamento recebido.

`POST /api/booking/checkout` retorna HTTP 503 sem gravar no banco. Os testes de concorrência verificam essa recusa, **não** uma criação transacional de reservas. A criação real continua pendente: transação para bloquear intervalos, cálculo financeiro no servidor, chave de idempotência, expiração de pendências, cobrança real e webhook autenticado do provedor.

As regras locais do Firestore proíbem criar, alterar e excluir reservas diretamente pelo cliente. Elas precisam ser publicadas separadamente para vigorar no ambiente remoto. Nenhum deploy foi realizado. Os métodos antigos de criação, resgate da fila e cancelamento no contexto recusam operações reais. A demonstração não persiste reservas no Firestore.

## Fonte dos dados e preparação do servidor

`GET /api/booking/availability?tenantId=ID&date=AAAA-MM-DD` consulta, com Firebase Admin:

- `arenas/{ID}`: documento com `courts` conforme o tipo `Court[]` do projeto e `operatingHours` com `open` e `close`. Campos opcionais: `timeZone` (padrão `America/Sao_Paulo`) e `bookingHorizonDays` (padrão 7; limite do servidor 90).
- `bookings`: registros filtrados por `tenantId` e `date`, contendo `courtId`, `startTime`, `endTime` e `status`. Estados reconhecidos: `confirmed`, `pending`, `cancelled`, `expired`. `expiresAt`, quando presente, usa data ISO. Pendências sem expiração verificável permanecem bloqueadas por segurança.
- `booking_blocks`: intervalos administrativos filtrados por `tenantId` e `date`, com `courtId`, `startTime` e `endTime`.

As credenciais de execução devem autorizar o Firebase Admin a ler essas coleções. O catálogo atual do aplicativo continua sendo local e está identificado como referência. O cadastro antigo de arena nas regras não aceita toda a configuração de quadras; sua configuração administrativa no servidor ainda precisa ser integrada ao painel. Não foi feita migração ou inserção de dados reais.

Configuração ausente, reserva ativa incompleta ou falha do banco produzem erro explícito. Não há substituição automática por dados de exemplo. A consulta é atualizada ao abrir a revisão, trocar data/arena, focar a janela e a cada minuto. Esse mecanismo não substitui a futura validação transacional no momento de reservar.

Para prévia local, defina explicitamente `VITE_BOOKING_DEMO=true` e reinicie o Vite. A interface identifica o modo de demonstração e bloqueia cobrança/reserva real. O padrão documentado em `.env.example` é `false`.

## Arquivos desta implementação

- Disponibilidade: `server/bookings.ts`, `server.ts`, `src/services/bookingAvailability.ts`, `src/services/bookingMode.ts`, `src/hooks/useArenaAvailability.ts`.
- Interface: `src/components/ArenaScheduleModal.tsx`, `BookingDatePicker.tsx`, `FreeSlotsDateTimeFilter.tsx`, `QuickBookingPaymentModal.tsx`, `HomeHighlights.tsx`, `ArenasDirectory.tsx`, `CourtScheduler.tsx`, `SmartNotificationBanner.tsx` e `src/App.tsx`.
- Estado e acessibilidade: `src/store/useBookingSelection.ts`, `src/store/useBookingLocation.ts`, `src/hooks/useModalFocus.ts`.
- Proteção do fluxo: `src/context/AppContext.tsx`, `firestore.rules`, `.env.example`.
- Testes: `tests/bookingAvailability.test.ts`, `tests/bookingRoutes.test.ts`.

## Verificação e limitações

Resultados: `npm run lint` e `npm run build` aprovados; `npm test` aprovado com 39 testes. Dois novos cenários de leitura do servidor foram acrescentados depois do início dessa execução e passaram na execução específica de `tests/bookingRoutes.test.ts` (6 testes aprovados, incluindo quatro já contados na suíte). O build mantém um aviso de tamanho de bundle acima de 500 kB. Os testes adicionais verificam disponibilidade, preços, fuso horário, privacidade, falhas do banco e recusa de checkout sem integração financeira.

Os testes de servidor usam respostas controladas; não substituem validação contra um Firestore real. A validação visual de desktop/celular e de navegação por teclado ficou bloqueada porque o navegador de teste não alcançou o servidor local. O fechamento e a contenção de foco usam o elemento HTML `dialog`, mas ainda precisam de homologação visual.

O projeto foi recebido na `main` em `05b631f`, com merge de `af6681f` em andamento. A atualização remota foi bloqueada por permissão de escrita nos metadados do Git. A criação de branch e de cópia Git isolada também não foi possível. As mudanças permanecem sem commit; o arquivo `CourtScheduler.tsx` teve os marcadores de conflito resolvidos preservando abas e seções dos dois lados, mas o índice Git continua marcado como não resolvido. É necessário revisar e concluir esse merge antes de publicar ou integrar uma branch de desenvolvimento.

Não foram modificados os motores de campeonato, resultados ou ranking nesta implementação. As alterações já existentes nesses arquivos pertencem ao estado recebido do repositório.

## Ajustes da interface solicitados em 19/10

- Faixa compacta no topo, sem o grande cartão de aluguel. Somente seleção de arena e hora inicial/final na faixa da home; sem filtros preenchidos, são mostradas as próximas quatro horas. O diretório mantém sua consulta por data.
- Cartão da arena abre sua página de agendamentos; botão de horário abre o checkout daquele intervalo, preservando todos os dados.
- Ao sair da home ou rolar além da faixa, um carrossel lateral apresenta horários de pico livres e mudanças de ocupado/bloqueado/aula para livre observadas durante a sessão. Uma primeira consulta não é anunciada como uma liberação nova. O carrossel tem controles de anterior, próximo, pausa e fechamento.
- A atualização em tempo real usa SSE e assinaturas do Firestore no servidor. O servidor projeta somente disponibilidade pública; o navegador não recebe dados pessoais de reservas. A consulta HTTP periódica permanece como alternativa de recuperação. É necessário configurar o Firebase Admin e as agendas reais.
- Adicionado INÍCIO na navegação geral e nas páginas de arena, tanto em celular como desktop. Ajustados espaçamentos da navegação e do seletor de campeonatos.
- Logo transparente original importada para public/brand/sharkset-logo-transparent.png, sem alterar seus bytes; usada no celular e na barra reduzida, com fundo do contêiner transparente e sombra leve.
- A tabela mantém o mesmo grafo e os mesmos resultados. As fases agora exibem FINAL, SEMI FINAL e DISPUTA DE 3º. Final e terceiro lugar foram alinhados às colunas vizinhas; rodadas posteriores seguem o eixo vertical dos confrontos de origem.

Validação desta atualização: TypeScript aprovado e 48 testes aprovados com `node --import tsx --test --test-concurrency=1 tests/*.test.ts`. A execução paralela anterior passou em 47 de 48 testes e falhou por falta de memória no teste de campeonatos grandes; esse teste passou isoladamente e na suíte sequencial completa. A validação visual no navegador continua pendente porque o navegador disponível não alcança o servidor local. O PNG aplicado foi comparado byte a byte com o anexo e seu canal alfa foi verificado.

Reinicie o servidor local para carregar a nova rota SSE. Não houve deploy ou publicação de regras remotas nesta atualização.

## LIVE, ranking e modo imersivo — 19/10

- Menu LIVE com localização autorizada (raio de 50 km), cidade/UF ou todas as transmissões. A rota pública GET /api/broadcasts lê no máximo 12 transmissões por solicitação e consulta somente as arenas desse lote. O cursor avança inclusive quando o lote não contém resultados para o filtro; nesse caso o visitante pode continuar a busca. Localização desconhecida aparece apenas na listagem geral. Nenhuma lista completa é baixada para filtrar no navegador.
- Transmissões abrem uma tela própria. Tela cheia solicita a API nativa do navegador e mantém uma superfície fixa por cima do aplicativo como alternativa. Vídeo e tabela permanecem montados ao alternar, com retorno direto à transmissão, placares pelo fluxo existente e sem controles de edição na tabela do espectador. Quando não existe associação conhecida, o visitante escolhe o campeonato explicitamente.
- Ranking com cabeçalho compacto, ações administrativas em Gerenciar, seleção de categoria visível e todas as categorias selecionadas inicialmente. Home mostra até cinco atletas, consultando a mesma fonte e o mesmo critério de classificação do ranking.
- Compartilhamento usa uma única imagem para prévia e exportação, com a logo transparente original e espaço reservado para patrocinador oficial (nenhum patrocinador foi inventado). Compartilhamento de arquivo usa o recurso nativo quando disponível; o WhatsApp de texto é identificado separadamente.
- Removidas contagens artificiais da faixa de jogos e do destaque ao vivo editados neste trabalho. Assistir não concede pontos.

Validação: 54 testes aprovados na suíte sequencial, TypeScript e build de produção aprovados. O aviso de tamanho do bundle continua existente. Tela cheia nativa, reprodução de vídeo e compartilhamento de arquivo ainda precisam de verificação visual em navegadores desktop/mobile; o navegador conectado não alcança o servidor local. Não houve deploy. Reinicie o servidor local para disponibilizar a nova consulta GET /api/broadcasts. A listagem depende das transmissões publicadas e de arenas reais configuradas no Firebase Admin.

Ajustes adicionais de navegação e localização:

- O mesmo filtro Perto de mim / Cidade / Todas no site é compartilhado entre LIVE, arenas e campeonatos, inclusive nas listagens da home. A escolha acompanha a navegação. Campeonatos usam a localização da arena vinculada; locais sem coordenadas ficam fora da busca próxima. A ausência de GPS não é substituída silenciosamente por Mineiros.
- INÍCIO permanece como primeira opção à esquerda e é a opção ativa inicial. LIVE está à esquerda de Transmissão ao vivo: LIVE abre o catálogo e usa fundo vermelho, texto branco e pulsação; Transmissão ao vivo abre o estúdio. A animação respeita a preferência de redução de movimento.
- Atalhos Ver transmissões, Localizar arenas, Ver Arena e Ver ranking usam a mesma superfície de vidro escuro, bordas e elevação dos botões do site, conforme o print enviado.
