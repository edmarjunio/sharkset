# Matriz inicial de permissões

Esta matriz descreve a intenção com base nas regras e fluxos vistos no código. Ela não autoriza implantação e não substitui os testes no Emulator Suite.

| Recurso | Visitante | Usuário autenticado | Gestor da arena | Administrador | Local de validação esperado |
| --- | --- | --- | --- | --- | --- |
| Perfil privado `user_profiles/{uid}` | Sem acesso | CRUD somente próprio, campos limitados | Igual ao usuário | Campos privilegiados somente via backend | Firestore Rules + Auth |
| `athlete_contacts/{uid}` | Sem acesso | Dono lê; gravação associada ao atleta próprio | Sem acesso fora do próprio recurso | Backend para suporte autorizado | Rules e vínculo com atleta |
| Atletas/ranking | Conforme consulta definida | Sem autoridade para pontos oficiais | Escopo aprovado de sua arena | Reprocessamento auditado no servidor | Cloud Function |
| Arenas | Sem acesso privado | Dono administra a própria | Administra sua arena | Suporte auditado | Rules + relação UID/arena |
| Quadras/aulas/alunos | Sem acesso privado | Sem acesso por ID arbitrário | Somente sua arena | Acesso de suporte auditado | Rules/Function |
| Reservas | Consulta do próprio, conforme produto | Consulta do próprio | Consulta da arena | Operação auditada | Backend transacional para escrita |
| Torneios/resultados | Leitura conforme visibilidade | Inscrição sem alterar resultado oficial | Gestão da própria arena | Correção auditada | Backend para avanço/ranking |
| Lives públicas | Leitura de projeção pública | Igual ao visitante | Gestão de sua transmissão | Gestão de suporte | Gateway/Functions; sem segredos no cliente |
| Notificações | Sem acesso | Somente destinatário | Avisos da própria arena conforme escopo | Envio via backend | Functions |
| Denúncias/chat | Somente conteúdo explicitamente público | Próprio e moderação | Escopo da arena | Suporte mínimo necessário | Rules/Function e retenção |

## Pontos a fechar

- Separar `ownerId` de `tenantId` e validar vínculo de membro em vez de confiar no ID enviado pelo navegador.
- Revisar regra `read, write` ampla nas subcoleções `arenas/{arenaId}/courts`, `tournaments`, `bookings` e `students`.
- A regra atual do perfil aceita papel `admin` via token/documento; a atribuição do papel precisa ser exclusivamente servidor.
- Testar usuário não autenticado, usuário de outra arena, usuário não verificado, campos extra, atualização de role/owner e operações concorrentes.
