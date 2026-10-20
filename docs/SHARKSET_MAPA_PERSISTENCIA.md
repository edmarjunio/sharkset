# Mapa atual de persistência

| Domínio | Fonte atualmente observada | Firestore existente | Estado |
| --- | --- | --- | --- |
| Identidade | Firebase Authentication | `user_profiles/{uid}` | Perfil conectado neste branch; sem migração de usuários de cache para contas novas. |
| Perfil rápido | `localStorage` global e dados de Auth | `user_profiles/{uid}` | A nuvem passa a prevalecer. A antiga chave global não é confiável para importação. |
| Arenas e quadras | `TENANTS` estático + `localStorage` (`sharkset_v3_arenas`) | `arenas`, `arenas/{id}/courts` | Ainda sem CRUD integrado do produto. Configuração estática precisa ser classificada como catálogo/demo ou dado real pelo responsável. |
| Reservas | `localStorage` (`sharkset_v2_bookings`), estado React | `bookings`, subcoleção de arena | Disponibilidade é consultada pelo servidor; escrita cliente é negada pelas regras. CRUD não conectado. |
| Lista de espera | `localStorage` (`sharkset_v1_waitlist`) | Não identificada | Não persistida centralmente. |
| Atletas | `localStorage` (`sharkset_v2_athletes`), cadastro automático e alguns writes parciais | `athletes_public`, `athlete_contacts` | Fonte fragmentada; ranking oficial não deve ser alterado pelo cliente. |
| Rankings e logs | `localStorage` e cálculo cliente | Sem ledger/serviço completo | Pendente: autoridade do servidor, idempotência e histórico auditável. |
| Aulas, turmas e alunos | `localStorage` (`sharkset_v2_class_students`) e estado de quadra | `arenas/{id}/students` | Pendente. Dados podem conter telefone; exige isolamento por arena. |
| Torneios | `localStorage` (`sharkset_v5_tournaments`) | `tournaments`, subcoleção da arena | Pendente; regras de competição precisam seguir a especificação privada do projeto antes de mexer em resultados/tabelas. |
| Duplas/inscrições | `localStorage` (`sharkset_v5_pairs`) | Sem coleção raiz específica identificada | Pendente; separar cadastro e estado de inscrição. |
| Partidas/resultados | `localStorage` (`sharkset_v5_matches`), eventos entre abas | Sem persistência autoritativa completa identificada | Pendente; resultados devem ir ao backend e ser idempotentes. |
| Lives | Estado da aplicação e coleção `broadcasts` administrada pelo backend | `broadcasts`, `livekit_rooms` e auxiliares LiveKit | Parte do diretório e da sessão já persiste. Verificar chamadas e campos antes de migrar qualquer cache. |
| Notificações | Zustand/localStorage + helper Firestore parcial | `notifications` | Duplicado; precisa de IDs idempotentes e dono/destinatário definido no servidor. |
| Votos MVP | localStorage e `match_mvp_votes` | Sim, parcial | Merge local/Firestore; identidade e duplicidade precisam de regra de negócio definida. |
| Academia | localStorage e `academy_posts` | Sim, parcial | Leitura/curtidas sem sincronização coerente; mídia não deve ficar como arquivo binário no Firestore. |
| Chat de partida | `localStorage` por partida | Não identificada | Pendente; definir público, moderação, limite e retenção. |
| Relatórios de integridade | `localStorage` | Não identificada | Pendente; pode incluir denúncia/dado pessoal, exige privacidade e acesso restrito. |
| Preferências | `localStorage` | Não necessária | Cache/preferência de UI: manter local salvo decisão contrária. |
| Imagens exportadas | IndexedDB | Cloud Storage só se houver requisito de compartilhamento | Cache/arquivo exportado; não migrar sem necessidade. |

## Fontes locais encontradas

As chaves de domínio estão em `src/context/AppContext.tsx`; caches adicionais estão em `src/store/useSharkStore.ts`, `src/components/MatchLiveDetailsModal.tsx`, `src/components/IntegrityReportModal.tsx`, `src/components/SharkAcademyCommunity.tsx` e `src/lib/firebase.ts`. A lista completa de preferências e caches está em `docs/SHARKSET_AUDITORIA.md`.
