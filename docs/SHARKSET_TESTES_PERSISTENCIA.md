# Plano de testes de persistência

## Testes que devem existir no Emulator Suite

- Perfil: leitura e atualização pelo próprio UID; rejeição por UID diferente, email/owner/id alterados, role privilegiado e campos não permitidos.
- Arena: usuário externo não lê nem altera dados privados; gestor só alcança a própria arena.
- Reservas: sobreposição simultânea não confirma duas reservas; cancelamento e repetição são idempotentes.
- Competições: resultados repetidos não duplicam avanço nem crédito de ranking; cliente não altera pontos oficiais.
- Lives: visitante só recebe campos públicos; câmera não anunciada não aparece; stop repetido é seguro.
- Sincronização: confirmar gravação, recarregar e autenticar em outro contexto; verificar ausência de escrita silenciosa.
- Migração: dry-run sem escrita, conflito detectado, repetição com mesmo migrationId sem duplicar e rollback de documentos criados pelo lote.

## Evidências desta etapa

- A inspeção confirmou o Firestore Standard `(default)` em `southamerica-east1` em consulta anterior somente leitura.
- Nenhum dado real foi contado nem modificado.
- Os testes existentes de funções LiveKit não cobrem regras/CRUD geral do Firestore.
- Testes de regras ainda não foram executados. A mudança de `firestore.rules` não deve ser publicada até adicionar/rodar a suíte contra o Emulator Suite.
