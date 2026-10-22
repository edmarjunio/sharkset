# Status da refatoração arquitetural

Data: 22/10/2026. Escopo: código, regras e configuração local. Nenhuma consulta ou escrita em dados reais de produção e nenhum deploy.

| Área | Estado | Pendência |
| --- | --- | --- |
| Cache do shell | Service Worker adicionado para assets versionados e fallback do HTML | Verificar em browser/staging, especialmente atualização de versão |
| Cache do YouTube | Explicitamente fora do Service Worker; vídeo permanece no player do provedor | Confirmar consentimento/UX e reprodução em dispositivos reais |
| Hosting/API | Rewrite `/api/**` configurado para `sharkset-api` em `southamerica-east1` | Criar/deploy Cloud Run antes de publicar Hosting |
| Placar ao vivo | Rota autenticada, autorização por torneio/arena, validação de estado e revisão otimista | Testes de rota e Rules no Emulator Suite |
| Escritas de partidas | Merge preserva projeção do placar ao vivo; regras negam edição direta do estado ao vivo pelo cliente | Validar Rules e índices antes de deploy |
| Multi-tenant | Arena e `tenantId` existentes; membership por UID usada no endpoint do placar | Uniformizar vínculos legados por UID/papel nas demais rotas |
| Agenda | Disponibilidade server-side via Express/SSE | Express ainda não publicado; checkout permanece fechado sem provedor |
| Pagamentos/assinaturas/tokens | Modelos/documentação parciais | Provedor, credenciais, webhook e conciliação |
| Ranking | Validação/cálculo no cliente e consultas limitadas | Ledger/projeção oficial no backend |
| Migração local | Preview sem escrita, reconhecimento de chaves UID-scoped | Resolver itens legados/orfãos com decisão do titular e staging |
| Escala/FinOps | Cache e limites documentados | Teste de carga e telemetria controlada |

## Entregas desta etapa

- Arquitetura, schema, fluxo de dados, multi-tenancy, modelo de segurança, cache, FinOps, migração e publicação documentados.
- `public/sw.js` com cache same-origin para assets versionados e shell; APIs e domínios YouTube permanecem fora.
- Rewrite do Hosting e `Dockerfile` para o backend Express no Cloud Run.
- Endpoint de gravação do estado de arbitragem com Firebase ID token, papel e controle de concorrência.
- `firestore.indexes.json` com os dois índices compostos usados pela disponibilidade.
- Nenhuma mudança nas regras esportivas de geração/avanço da tabela, BYEs, semis ou ranking.

## Verificação

- `npm run lint`: passou.
- `npm run build`: passou; Vite emitiu o aviso já conhecido sobre `/brand/deep-ocean.jpg` ausente e chunks Firebase/LiveKit grandes.
- Testes direcionados de placar ao vivo e migração local: 6/6 passaram.
- Emulator Suite não iniciou porque Java não está instalado/disponível (`spawn java ENOENT`); as regras ainda precisam de validação automatizada.
- Browser/staging, teste de carga e deploy continuam pendentes.
- `technical_table/` permanece fora do Git e do contexto público.
