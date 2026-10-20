# Modelo de dados Firestore (estado e proposta)

Este documento separa o que já aparece nas regras/código da arquitetura alvo. Coleções propostas não devem ser criadas em produção sem contratos, testes, índices e aprovação.

## Coleções existentes no código/regras

| Coleção | Uso observado | Campos/relacionamento conhecido | Fonte de autoridade |
| --- | --- | --- | --- |
| `user_profiles/{uid}` | Perfil privado do usuário | `id`, `ownerId`, `displayName`, `email`, `role`; opcionais `level`, `photoURL`, `phone`, `experienceCategory`, `managedArenaId`. UID é o documento. | Auth + perfil no Firestore. `role` não deve ser concedido pelo cliente. |
| `arenas/{arenaId}` | Arena e dono | `id`, `ownerId`, `name`, `city`, `state`; metadados opcionais conforme regras. | Backend/gestor da arena. |
| `arenas/{arenaId}/courts/{courtId}` | Quadras | Subcoleção de arena; regras atuais não validam formato. | Backend/gestor da arena. |
| `arenas/{arenaId}/tournaments/{tournamentId}` | Torneios por arena | Subcoleção, regras atuais liberam escrita ampla ao organizador. | Backend de competição. |
| `arenas/{arenaId}/bookings/{bookingId}` | Reservas por arena | Subcoleção, regras atuais liberam escrita ampla ao organizador. | Backend transacional. |
| `arenas/{arenaId}/students/{studentId}` | Alunos de arena | Subcoleção, regras atuais liberam escrita ampla ao organizador. | Backend/gestor da arena. |
| `tournaments/{id}` | Dados do torneio | `id`, `tenantId`, `name`, `sport`, `category`, `date`, `ownerId`; demais campos listados em `firestore.rules`. | Backend para criação/edição oficial e progressão. |
| `court_blocks/{id}` | Bloqueios de quadra | `id`, `tenantId`, `courtId`, data/horário, `ownerId`. | Backend/gestor da arena. |
| `bookings/{id}` | Reserva | `id`, `tenantId`, `courtId`, data/horário, estado e dono. Regras atuais negam escrita cliente. | Backend transacional; cliente não grava estado de pagamento. |
| `athletes_public/{id}` | Projeção de atleta/ranking | Nome, nível, pontos, cidade/arena e `ownerId`. Apesar do nome, regras atuais protegem por dono. | Ranking no servidor; exposição pública a definir. |
| `athlete_contacts/{id}` | Contato privado | `ownerId`, telefone e consentimento WhatsApp. | Atleta/servidor, mínimo acesso necessário. |
| `notifications/{id}` | Notificações | `id`, tipo, título, corpo, dono. | Backend para eventos; cliente só consulta o destinatário. |
| `match_mvp_votes/{id}` | Votos MVP | IDs de partida/torneio, jogador, votante e dono. | Backend para controle de duplicidade/eligibilidade. |
| `academy_posts/{id}` | Conteúdo da Academia | Título, categoria, tipo/link de mídia, resumo, autor, nível e curtidas. | Backend/moderação conforme política. |
| `broadcasts/{id}` | Projeção pública de transmissões | Leitura pública; escrita cliente negada. | Serviço LiveKit/backend. |
| `livekit_rooms` e auxiliares | Sessões, locks, eventos, limites | Implementação server-side na codebase LiveKit. | Cloud Functions/Admin SDK. |

## Coleções propostas ainda pendentes de contrato

| Domínio | Proposta inicial | Observações |
| --- | --- | --- |
| Lista de espera | `waitlist/{id}` ou `arenas/{arenaId}/waitlist/{id}` | Definir retenção, consentimento e transição atômica para reserva. |
| Inscrições/duplas | `tournaments/{id}/registrations/{id}` | Separar par, estado de aprovação e pagamento; impedir alteração de status financeiro pelo cliente. |
| Partidas | `tournaments/{id}/matches/{id}` | Versionamento/revisão e transições idempotentes controladas pelo backend. |
| Ranking | `ranking_events/{eventId}` + projeções | Eventos imutáveis e cálculo por servidor; nunca gravar ponto oficial enviado pelo browser. |
| Aulas/matrículas | `arenas/{arenaId}/classes/{classId}` e `enrollments/{id}` | Dados de aluno e cobrança exigem isolamento e minimização. |
| Chat e integridade | Coleções restritas por partida/arena | Definir moderação, retenção e acesso antes de migrar conteúdo local. |

## Índices

Não existe `firestore.indexes.json` no repositório. Antes de conectar consultas por `tenantId`, status, data, arena e cursor, capturar as consultas exatas e versionar os índices compostos necessários. Não criar índice especulativo que gere custo ou não sirva uma consulta real.
