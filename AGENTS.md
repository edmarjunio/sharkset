# SHARKSET — instruções do projeto

## Tabela de campeonato
Antes de alterar geração de chave, avanço de resultados, BYEs, semifinais,
pontuação de sets, layouts ou relatórios, leia `technical_table/LEIA_PRIMEIRO.txt`
e as seções pertinentes de `technical_table/ESPECIFICACAO_SHARKSET.md`.
Use os cenários e arquivos de referência dessa pasta para validar as mudanças.
O documento é a fonte de verdade; não substitua regras por conveniência da interface.
Se a pasta não estiver disponível, solicite acesso antes de alterar essas regras.

`technical_table/` é material privado. Nunca adicionar seus arquivos ao Git,
ao diretório público, ao bundle do navegador ou aos relatórios exportados.
Não copiar a especificação para documentação pública. O gitignore não remove
arquivos já versionados: conferir `git ls-files technical_table` antes de publicar.

## Implementação
Funções pequenas, nomes em inglês, validação no servidor e erros explícitos.
Resultados, ranking e notificações precisam ser idempotentes. Nunca creditar
ranking por prévia de câmera, transmissão livre ou participantes fictícios.
Não apresentar contagens simuladas de espectadores como reais.
