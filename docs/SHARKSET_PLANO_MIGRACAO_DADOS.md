# Plano de migração para Firestore

## Princípios

- Não gravar em produção até haver aprovação explícita, backup, dry-run reconciliado e rollback.
- Firebase Auth é a fonte de identidade. Nunca criar conta a partir de `localStorage`, importar senha ou vincular registro por email sozinho.
- IDs existentes devem ser preservados quando válidos; normalização/colisão gera conflito para revisão, não sobrescrita.
- Nenhuma gravação automática apaga o documento destino. Escritas futuras devem ser idempotentes e registrar versão/origem.
- Dados demo, catálogo estático e mocks não serão migrados como dados reais.

## Fases

1. **Descoberta:** inventariar bancos, chaves locais, documentos de exemplo apenas em ambiente aprovado, telas e papéis. A auditoria está em `SHARKSET_AUDITORIA.md`.
2. **Fundação:** definir contratos e repositórios, regras e índices, testes no Emulator Suite e estados de erro. A leitura/gravação de perfil está iniciada neste branch.
3. **Usuários e arenas:** mapear registros para UID/arena com confirmação do dono; não mesclar usuários por email não verificado.
4. **Aulas, alunos e reservas:** backend transacional para conflito de quadra e isolamento multi-tenant; primeiro em emulador/staging.
5. **Competições e ranking:** migrar estado preservando IDs e invariantes; lógica autoritativa no servidor, após ler a especificação privada pertinente.
6. **Lives e complementos:** auditar projeção pública, notificações, comunidade, chats e denúncias; arquivos binários para Storage quando necessário.
7. **Dry-run e reconciliação:** comparar contagens por coleção, documentos inválidos, duplicidades, conflitos e bytes estimados. Sem escritas.
8. **Backup e aprovação:** backup exportado/restaurável, plano de rollback testado e aprovação explícita para qualquer gravação real.
9. **Execução gradual:** lote idempotente com checkpoints e relatório de antes/depois; smoke tests e monitoramento.

## Estratégia de rollback

Antes da migração real, exportar backup e manter arquivo de reconciliação com origem, destino, ID, hash dos campos, status e erro (sem dados pessoais em logs). Reverter por lote somente a documentos criados por essa execução, identificados por `migrationId`; nunca apagar/reescrever documento preexistente automaticamente.

## Limitação atual

Não há contagens de cache nem do Firestore registradas nesta etapa. O banco real não foi lido, e a migração em navegador precisa de uma ferramenta de pré-visualização e decisão explícita para resolver itens órfãos/duplicados antes da escrita.
