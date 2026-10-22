# Fluxos de dados atuais

## Perfil

Firebase Auth fornece a identidade. O UID é usado em `user_profiles/{uid}`. Dados locais legados sem prova de titularidade não são atribuídos automaticamente a quem entrar.

## Catálogos e cache

O frontend tenta exibir cache público limitado e revalida em rede. Arenas e torneios ainda têm leituras de catálogo não paginadas. A leitura paginada de lives e a leitura sob demanda da agenda são fluxos existentes.

## Agenda e reservas

Cliente → `/api/booking/availability` e `/api/booking/stream` → Express/Admin SDK → configurações da arena, `bookings` e `booking_blocks` → projeção de horários livres. SSE compartilha snapshots por processo. `/api/booking/checkout` responde 503 e não grava reservas, bloqueios nem pagamento.

## Torneios e resultados

O cliente preserva a tabela local para compatibilidade. Metadados têm persistência parcial no Firestore; partidas podem ser observadas por torneio. Uma Cloud Function valida mudanças oficiais e publica eventos idempotentes em `result_events`. Isto não significa que ranking global esteja integralmente calculado no servidor.

## Lives

LiveKit mantém o transporte de mídia. Firestore mantém metadados. A API Express local não é implantada pelo `firebase.json`; Functions privadas estão limitadas ao gateway LiveKit configurado.

## Pagamentos

Não há fluxo financeiro ativo para reservas, assinatura ou token com provedor e webhook homologados. A interface não pode tratar retorno de checkout, cache ou comprovante como confirmação.
