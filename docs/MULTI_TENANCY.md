# Isolamento de arenas

## Contrato atual

Documentos existentes usam `tenantId` em torneios, reservas e bloqueios; o frontend também trabalha com `TenantConfig`. O nome canônico para novos contratos é `arenaId`, mantendo leitura compatível com `tenantId` até migração validada.

## Identidade e autorização

Firebase Auth UID é a identidade estável. A autorização atual combina dono e a lista legada `managers` em `arenas/{id}`; a lista pode conter e-mail ou UID. Esse vínculo deve migrar para `arena_members/{arenaId}/users/{uid}` provisionado por backend, com papéis por arena. Não tratar `arenaId`, e-mail ou papel enviado pelo navegador como prova suficiente.

## Papéis-alvo

`owner`, `manager`, `coach`, `staff`, `athlete` e `global_admin`, sempre avaliados dentro do tenant. A atribuição de `global_admin`, owner e acesso comercial deve ser confiável e auditável. A autorização de backend com Admin SDK precisa ser explícita, pois não é limitada pelas Firestore Rules.

## Migração segura

Manter campos/IDs existentes durante uma janela de compatibilidade; mapear arena e membro por UID validado; gerar prévia com órfãos, duplicados e conflitos; testar no emulador/staging; migrar em lotes idempotentes com origem e rollback documentados. Nenhum dado de produção foi lido ou migrado nesta auditoria.
