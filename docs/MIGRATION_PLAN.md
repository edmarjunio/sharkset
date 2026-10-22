# Plano de migração de dados

O inventário de chaves e domínios está em `SHARKSET_MAPA_PERSISTENCIA.md` e `SHARKSET_AUDITORIA.md`. `buildLocalDataMigrationPreview` reconhece versões operacionais e legadas, agrega caches por UID sem devolver o sufixo de UID, conta tamanho/registros e nunca escreve dados.

1. Classificar cada chave local em dado oficial, cache, preferência, temporário, demonstração ou legado sob revisão.
2. Não importar reservas, atletas, torneios, duplas, partidas, pagamentos ou ranking vinculando por e-mail. Exigir UID e confirmação de titularidade.
3. Criar exportação/dry-run que preserve IDs e mostre duplicados, órfãos, conflitos e dados inválidos, sem escrever.
4. Validar contratos e regras no Emulator Suite e staging com backup e plano de rollback.
5. Migrar domínio por domínio em lotes idempotentes, registrar origem/versão/status e reconciliar contagens.
6. Só depois de validação, tornar o Firestore/backend a fonte oficial do domínio e retirar escrita local.

Nenhuma leitura ou gravação de documentos reais de produção, importação ou exclusão foi realizada nesta auditoria. As chaves antigas permanecem disponíveis para análise controlada.
