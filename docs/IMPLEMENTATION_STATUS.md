# SHARKSET — estado da arquitetura

Atualizado em 22/10/2026. Este documento descreve o código local; não significa que as mudanças já estejam publicadas em produção.

| Área | Estado no código | Falta para produção |
| --- | --- | --- |
| Login/perfil | Perfil básico é criado ao criar conta; primeira gravação do app também inclui nível padrão | Publicar Functions e regras; validar conta Google nova |
| Papéis globais | Rules e Functions reconhecem e-mail do dono, `platformAdmin` e `admins/{uid}` | Provisionar gestores de plataforma com acesso administrativo controlado |
| Arena/campeonato | Campeonato exige arena e sua criação/token são gravados numa transação de servidor | Publicar Functions e rules; migrar documentos legados se necessário |
| Tokens | Checkout Pro cria pedido pendente; webhook valida assinatura, consulta pagamento e credita saldo uma vez | Cadastrar os dois secrets, configurar Webhook e testar pagamento aprovado |
| Comunidade/aulas | Feed lê Firestore; post informa autoria de perfil ou arena; curtida é idempotente por conta | Publicar Functions e rules; revisar/migrar posts antigos que só existam no navegador |
| YouTube/cache | Vídeos seguem no player do YouTube; caches do site não copiam a mídia | Verificar reprodução e consentimento em dispositivos reais |
| Carregamento | Code splitting e caches de leitura permanecem parciais | Auditar rotas e telemetria após publicação |
| Agenda/reserva | Disponibilidade server-side existe; reserva e cancelamento online ainda estão bloqueados | Publicar o backend Express no Cloud Run e concluir o fluxo de reserva/confirmar com a arena |
| Transmissão | LiveKit e player YouTube existem; ainda há transmissões que não exigem partida/reserva como origem | Associar cada sessão a reserva ou partida e validar início/fim |
| Ranking | Parte do estado e cálculo ainda depende do cliente/localStorage | Migrar para ledger e projeção oficial idempotente no backend |
| Firestore | Mudanças de regra local protegem saldo e pagamentos; root `tournaments` ainda usa `tenantId` como vínculo com arena | Publicar as regras; planejar migração para hierarquia física de subcoleções sem duplicar dados |

## Publicação das mudanças desta etapa

Depois de cadastrar os secrets descritos em [MERCADO_PAGO_TOKENS.md](MERCADO_PAGO_TOKENS.md), publique `firestore:rules` e `functions`. Publique o Hosting em um comando separado somente depois de confirmar que `sharkset-api` existe em `southamerica-east1`, porque o rewrite `/api/**` depende desse Cloud Run.

Não publicar a pasta privada `technical_table/` em Hosting, Git ou bundles.
