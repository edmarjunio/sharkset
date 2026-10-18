# Verificação da entrega — 18/10/2026

## Implementado no código
- Logo original em `public/brand/logo.png`, usada pelo componente compartilhado e relatórios.
- Fundo original em `public/brand/background.png`, com camada clara para leitura.
- Elevação global dos botões, foco de teclado e respeito à redução de movimento.
- Controle compartilhado de placar, sets e cronômetro com identidade SHARKSET.
- Transmissão livre na tela de ranking e na página da arena; tela pública por `?broadcast=ID`.
- Placar das transmissões livres persistido no Firestore; alterações pelo dono, validação no servidor e revisão para detectar conflitos.
- Categoria escolhida no cadastro existente; contas novas começam sem jogos ou pontos fictícios.
- Progresso por categoria e promoção com mínimo de 6 jogos, 4 vitórias e 60% de aproveitamento, além do limite de pontos.
- Reset do progresso ativo após 30 dias completos, preservando categoria histórica para inscrição justa.
- Utilitário `checkPlayerInactivity` no AppProvider, com verificação autenticada no servidor.
- Rotina paginada de inatividade, envio por template WhatsApp e registro de envio por ciclo.
- Instrução permanente em AGENTS.md para consultar a referência privada antes de alterar campeonatos.

## Ainda não concluído para produção
- Captura e publicação direta de câmera: falta contratar/configurar e integrar serviço de vídeo (SFU/CDN). O painel aceita URL de reprodução; câmera local é apenas prévia.
- Ranking de lives: bloqueado até existir prova de vídeo e resultado validado transacionalmente no servidor.
- Resultados de torneio e ranking ainda utilizam estado local em partes do aplicativo. Falta migrar a apuração oficial para transações auditáveis e sincronizar todos os participantes por IDs estáveis.
- As telas antigas ainda contêm demonstrações e textos extensos. A simplificação de toda a navegação não está concluída.
- O formulário de preferência/consentimento para lembretes por WhatsApp ainda precisa ser integrado ao perfil. Contatos privados são lidos de `athlete_contacts/{athleteId}` com `ownerId`, `phone` (apenas dígitos com país) e `whatsappOptIn`.
- A categoria histórica é preservada no reset. Não foi implementado rebaixamento de jogadores experientes para iniciante.
- Não foi feita auditoria integral nem substituição do motor de campeonato conforme todos os cenários privados.
- Faltam testes reais em múltiplos dispositivos, teste de carga e revisão visual responsiva no navegador.
- Imagens originais somam aproximadamente 21 MB; preparar versões de entrega otimizadas antes de produção.

## Ativação das integrações
1. Instalar dependências com `npm ci`; executar `npm run dev`.
2. Configurar credenciais de aplicação do Firebase Admin e o banco indicado em `.env.example`.
3. Publicar as regras do Firestore após revisão e testes no emulador. Não foram publicadas nesta tarefa.
4. Configurar token, identificador do número, versão da API e template WhatsApp aprovado, com parâmetros nome e dias restantes. Texto sugerido: “Oi, {{1}}! Que tal voltar à quadra? Faltam {{2}} dias para seu progresso ativo no SHARKSET zerar. Uma partida válida renova sua atividade. Bora jogar?”
5. Agendar diariamente POST `/api/jobs/ranking-inactivity` com bearer `INACTIVITY_JOB_SECRET`. Continuar as páginas passando `nextCursor` no campo `cursor` até receber null. O agendamento não foi provisionado.
6. Conferir `inactivity_dispatches`: `accepted` indica aceite pela API, não entrega no celular. `failed` e `unknown_delivery` exigem revisão; não há reenvio cego que possa duplicar mensagens.
7. Migrar a última partida válida para `athletes_public.lastMatchAt` em ISO UTC. Datas ausentes ou inválidas não causam reset. Ainda não existe backfill automático de partidas históricas.

## Validação
- TypeScript e build de produção executados.
- Testes locais cobrem limites de 30 dias, datas inválidas, retomada e promoção.
- `technical_table/` ignorado e sem arquivos rastreados no Git.
- Nenhuma mensagem WhatsApp enviada; nenhum serviço publicado.
