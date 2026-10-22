# Relatório de testes de carga

## Estado

Não foram executados testes de carga de 1.000 arenas ou concorrência de produção. Não há benchmark que comprove milhares de usuários simultâneos.

## Preparação existente

Há testes unitários/de integração para disponibilidade e concorrência em rotas bloqueadas, recursos de carregamento, resultados de torneio e Functions. O relatório de carregamento em `loading-architecture-report.md` mede tamanho dos chunks do build; não mede sessões reais nem carga Firestore.

## Próxima validação em staging

Usar Firebase Emulator Suite ou projeto de staging e dados sintéticos. Medir volume e duração da carga, ramp-up, p50/p95/p99, erro, leituras/gravações, listeners ativos, contenção de reserva e custo estimado. Testar isolamento entre arenas, duas reservas no mesmo intervalo, repetição de webhook e atualização concorrente de placar. Anexar os resultados obtidos; não extrapolar para produção sem evidência.
