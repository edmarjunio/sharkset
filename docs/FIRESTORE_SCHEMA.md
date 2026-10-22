# Esquema Firestore observado

O documento de referência é `SHARKSET_SCHEMA_FIRESTORE.md`. Esta versão resume a separação entre dados já encontrados e arquitetura proposta; coleções-alvo não devem ser criadas em produção sem migração aprovada.

## Coleções usadas ou reconhecidas no código e nas regras

| Caminho | Uso atual observado | Limite principal |
| --- | --- | --- |
| `user_profiles/{uid}` | Perfil autenticado privado | Campos esportivos e papéis ainda têm contratos legados |
| `arenas/{arenaId}` | Catálogo/configuração, quadras embutidas | Quadras também aparecem em subcoleção; fonte oficial precisa de decisão |
| `arenas/{arenaId}/courts/{courtId}` | Quadras | Escrita e validação precisam de alinhamento com o modelo embutido |
| `tournaments/{id}` e `matches`, `result_events` | Metadados, partidas e eventos oficiais | Compatibilidade usa `tenantId`; catálogo ainda pode ser leitura ampla |
| `bookings/{id}`, `booking_blocks/{id}` | Consultas de ocupação da agenda | Checkout retorna 503; confirmação transacional não está disponível |
| `broadcasts/{id}`, `broadcast_tournament_links/{id}` | Diretório de transmissão e vínculo | LiveKit/backend é a autoridade para sessões |
| `athletes_public/{uid}`, `athlete_contacts/{uid}` | Perfil esportivo e contato privado | Projeção pública ainda não é ranking público global completo |
| `arena_access/{uid}`, `coupons/{id}` | Acesso comercial e cupons | Pagamento/webhook não integrado; não ativar direito pelo cliente |
| `notifications`, `match_mvp_votes`, `academy_posts` | Dados auxiliares | Integração parcial e políticas por domínio pendentes |
| Coleções `livekit_*` | Salas, locks e eventos | Geridas pela codebase LiveKit |

## Projeções e coleções propostas

`ranking_events`, `ranking_views`, `payment_webhook_events`, inscrições separadas e dados privados por modalidade são propostas de evolução, não fontes de verdade atualmente confirmadas. Não espelhar documentos completos nem criar subcoleções apenas para refletir componentes de interface.

## Índices versionados

`firestore.indexes.json` inclui os índices compostos requeridos pelas consultas observadas de disponibilidade por `tenantId` e `date` em `bookings` e `booking_blocks`. Consultas futuras devem adicionar índice somente quando o código real exigir; regras e índices ainda precisam ser validados no Emulator Suite antes de deploy.
