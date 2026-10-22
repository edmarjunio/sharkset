# Arquitetura atual e alvo do Sharkset

## Estado observado

- Frontend: React + TypeScript + Vite, Firebase Authentication e Firestore Web SDK.
- Backend local/Node: Express em `server.ts`, com rotas de agenda, lives, LiveKit e WhatsApp.
- Backend implantável declarado: Cloud Functions Gen 2 na codebase `functions`; hoje inclui LiveKit e gatilhos de resultados/notificações.
- Hosting: Firebase Hosting publica `dist` e faz fallback SPA. Não há rewrite `/api` para o Express nem configuração de Cloud Run. Portanto, rotas do Express não são automaticamente endpoints de produção.
- Banco configurado: projeto `sharkset-70de4`, Firestore `(default)`. Esta documentação não consulta nem altera dados do projeto.

## Fluxo arquitetural em vigor

O shell carrega módulos de tela sob demanda. Recursos públicos usam recursos em memória com TTL e caches locais limitados. Agenda usa endpoint de disponibilidade e SSE; o servidor compartilha listeners por arena/data dentro de um processo. Tabelas e eventos de resultados usam listeners Firestore específicos e compartilhados. LiveKit é carregado somente ao abrir a transmissão.

Os dados de negócio ainda não seguem uma única autoridade: parte usa Firestore, parte permanece em `localStorage` por UID e parte vem de fixtures/catálogos estáticos. Ver `SHARKSET_MAPA_PERSISTENCIA.md` para inventário e `loading-architecture-report.md` para limites das medições.

## Direção de evolução

Manter um único projeto Firebase e uma codebase de backend por domínio enquanto os limites de deploy permitirem. A identidade é o UID do Firebase Auth. Novos contratos devem usar `arenaId`; contratos existentes com `tenantId` permanecem até haver migração validada. Operações concorrentes, financeiras ou que alterem resultados oficiais devem ser autoritativas e idempotentes no backend.

Não há base para declarar escalabilidade validada para 1.000 arenas: faltam carga controlada em staging, medição de campo, índices completos por consultas observadas e endpoints operacionais de reserva/pagamento.
