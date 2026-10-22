# Cache e carregamento

O relatório detalhado está em `loading-architecture-report.md`.

| Dado | Estratégia | Observação |
| --- | --- | --- |
| Assets versionados | Service Worker cache-first por hash | Cache imutável e limitado aos próprios arquivos estáticos |
| HTML | Network-first | Usa cópia local apenas como fallback offline |
| Arenas públicas | Memória TTL + projeção local limitada | Revalida catálogo; consulta ainda não paginada |
| Metadados de torneios | Memória TTL/stale e eventos | Consulta ainda não paginada |
| Ranking | Recurso compartilhado, TTL e escopo por conta | Limite atual de 100 e fonte por `ownerId` |
| Agenda | Recurso por arena/data, SSE e HTTP no-store | Encerra listeners quando não há consumidor |
| Lives | Cache curto por filtro/cursor | Endpoint limita a página |
| Dados privados | Sem persistência Firestore geral no boot | Evita cache local persistente sem escolha confiável |
| YouTube/YouTube nocookie | Player e vídeo carregados pelo iframe do provedor | Não armazenar vídeo, iframe ou resposta de terceiros |

`public/sw.js` só armazena arquivos estáticos same-origin com hash em `/assets/`. `/api/*`, autenticação, escritas e hosts externos são ignorados. O vídeo continua servido pelo YouTube; o SHARKSET guarda apenas seus próprios arquivos. A disponibilidade offline limita-se ao shell e aos arquivos estáticos já carregados.

Não guardar tokens ou dados financeiros em cache público. Novos recursos devem ter chave de cache por UID quando privados, cancelamento de consulta obsoleta, política de TTL documentada e invalidação depois de gravação oficial. O `localStorage` usado para operações de negócio ainda é legado e precisa de migração por domínio.
