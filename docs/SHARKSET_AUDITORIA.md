# Auditoria de persistência SHARKSET

**Estado:** auditoria inicial no branch `codex/firestore-persistence`. Sem gravações, deploys ou alterações no projeto Firebase.

## Configuração observada

- Firebase project id no `.firebaserc` e `firebase-applet-config.json`: `sharkset-70de4`.
- Firestore `(default)`: Standard / Firestore Native, região `southamerica-east1` (consulta somente leitura feita anteriormente pelo Firebase CLI).
- `firebase.json` aponta regras para `firestore.rules`, Hosting para o site `sharkset` e publica `dist` como SPA.
- A listagem de sites Hosting não pôde ser consultada nesta sessão por bloqueio de rede local. O ID do site configurado no repositório é `sharkset`; o domínio `sharkset.web.app` precisa ser conferido no console antes de qualquer publicação.
- Não há `firestore.indexes.json` nem configuração de Cloud Storage Rules no repositório.
- O SDK Web ativa persistência offline IndexedDB. Isso é cache local do SDK; não substitui a fonte de verdade remota.
- A codebase Cloud Functions implantável contém apenas endpoints LiveKit. O `server.ts` de Express não está declarado em `firebase.json` e não deve ser tratado como backend de produção.

## Inventário resumido e severidade

| Severidade | Achado | Evidência / impacto |
| --- | --- | --- |
| Alto | Dados essenciais mantidos em `localStorage` no `AppContext`: reservas, lista de espera, arenas, atletas, rankings, alunos, torneios, duplas e partidas. | Os estados são carregados do navegador e escritos de volta em efeitos. Não sincronizam por usuário/dispositivo e não são recuperáveis em outro dispositivo. |
| Alto | Perfil do usuário usa uma chave local compartilhada; nível também é mantido por UID local. | A chave compartilhada pode misturar informações entre contas no mesmo navegador. O branch passa a ler/gravar o perfil autenticado em `user_profiles`; a antiga chave não será importada automaticamente. |
| Alto | Várias gravações Firestore são opcionais ou falham sem impedir sucesso visual. | `persistBookingToFirestore`, `persistAthleteToFirestore`, notificações e posts têm retornos silenciosos sem usuário verificado; alguns componentes mostram sucesso após tentar gravar. |
| Alto | Cadastro automático de atleta associa informações locais a conta sem prova de titularidade. | `AppContext` cria atletas a partir do login e email, com valores padrão de localidade/arena. Não deve virar migração automática. |
| Alto | Regras, modelos e chamadas não formam um CRUD integrado consistente. | `firestore.rules` restringe escrita direta em bookings e protege coleções por `ownerId`, enquanto algumas chamadas cliente tentam gravar. |
| Médio | Conteúdos de chat e relatórios de integridade ficam apenas no navegador. | `MatchLiveDetailsModal` e `IntegrityReportModal` gravam em `localStorage`. Não há leitura multiusuário nem retenção central. |
| Médio | Academia combina cache local com tentativa de gravação Firestore. | Criação e curtidas atualizam UI/cache antes de confirmar gravação e a lista inicial não lê Firestore. |
| Médio | Notificações gerais ainda usam Zustand/localStorage. | `src/store/useSharkStore.ts`; há também helper Firestore para notificações, mas não é a origem única. |
| Médio | Dados estáticos e iniciais misturam catálogo, conteúdo demonstrativo e estado de negócio. | `src/data/tenants.ts`, `src/data/initialData.ts`; precisam ser classificados antes de qualquer importação. |
| Baixo | Preferências visuais e dados efêmeros permanecem no navegador. | Idioma, buscas recentes, modo foco, fundo animado, seleção de visualização e estado de onboarding. Podem continuar como preferências locais. |
| Baixo | IndexedDB mantém imagens exportadas de cards. | `src/services/podiumPhotoStore.ts`; são arquivos de saída/cache, não registros canônicos de negócio. |

## Autenticação, permissões e risco

Firebase Authentication é a identidade disponível. O ID estável para associação é `request.auth.uid`; email não deve ser chave de migração nem prova de titularidade de registro local. `user_profiles` é privado por dono nas regras atuais. `athletes_public` é nome de coleção, mas suas regras atuais também são por proprietário; o nome não o torna público.

`broadcasts` permite leitura pública e bloqueia escrita cliente. Preservar a transmissão pública requer projeção pública deliberada e minimizada; revisar isso antes de ampliar campos.

As regras têm negação global como padrão, mas alguns subdocumentos da arena permitem `read, write` amplo ao organizador. A autorização desses subcaminhos precisa ser detalhada antes de transformar a coleção em fonte de verdade.

## Mudanças locais nesta etapa

- Adicionada leitura e persistência de `user_profiles/{uid}` no cliente autenticado.
- O perfil da nuvem prevalece; a chave local global antiga não é importada.
- O perfil usa somente o UID autenticado, impede criação cliente de papéis privilegiados e adiciona telefone opcional sob regra de leitura do próprio dono. Nível/categoria são opcionais até o usuário escolher os dados de atleta.
- Regras e código local não foram publicados. A etapa ainda precisa de testes de Security Rules no Emulator Suite antes de deploy.

## Limites da auditoria

Não foram listados nem lidos documentos reais de produção. Portanto, este inventário descreve código e configuração, não contagens de registros do banco. Não foi possível calcular custos sem volume, padrão de consultas, tráfego e região de usuários.
