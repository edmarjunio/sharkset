# FinOps Firestore

## Medidas já presentes

- Limites de página em diretórios de live, ranking, MVP e eventos de resultado.
- Deduplicação de leituras/assinaturas em recursos compartilhados.
- Cache local limitado e invalidação por evento em alguns catálogos.
- Agenda usa snapshots compartilhados por arena/data e não grava cada horário livre.
- Índices compostos observados para consultas de disponibilidade foram versionados em `firestore.indexes.json`.

## Lacunas

Catálogos de arena e torneio ainda podem buscar coleções inteiras; várias operações de negócio ainda só usam estado do navegador. Não há métricas por arena/módulo nem dados suficientes para estimar custo real ou confirmar 1.000 tenants. Não foram inventados benchmarks.

## Operação

Medir leituras/gravações por jornada no staging, latência p50/p95, listeners ativos, erros e custo em ambiente com dados sintéticos. Adicionar índices para consultas reais a partir de erros/consultas reproduzíveis. Revisar TTL/retention para dados efêmeros antes de habilitar collections de presença/eventos.
