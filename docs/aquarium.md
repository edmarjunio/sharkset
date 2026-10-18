# Fundo animado SHARKSET

Animação em camadas (2.5D), criada por código a partir de imagens geradas com base na referência fornecida. Não é uma simulação ou um filme 3D com personagem modelado e rigado.

## Comportamento

- Câmera fixa; cenário da quadra submersa preservado.
- Luz volumétrica, reflexos sobre a areia e bolhas em duas profundidades.
- 0–20 s: nado calmo, com ondulação mais forte na cauda.
- 20–22 s: aproximação ao centro e virada para a câmera.
- 22–25 s: sorriso, entrada da bola amarela com estrela preta e duas embaixadinhas.
- 25–27 s: giro e lançamento da bola com a cauda.
- 27–30 s: volta ao nado e à posição do começo do ciclo.

O painel do site cobre parte do centro da cena. A página `aquarium-preview.html` permite observar toda a animação sem esse painel.

## Integração

`AquariumBackground` compõe o fundo do aplicativo. Usa Canvas 2D, sem bibliotecas de animação adicionais, e mantém os controles da interface clicáveis. Um botão pausa o movimento; a preferência de movimento reduzido é respeitada e o avanço para quando a aba fica em segundo plano. O cenário fica fora das telas que usam a identidade visual própria da arena.

O poster aparece enquanto os três elementos são carregados ou se houver falha. A resolução do canvas acompanha a janela, limitada a 3840 × 2160 pixels. Não há áudio.

## Resolução e qualidade

Full HD: 1920 × 1080. 4K UHD: 3840 × 2160. As imagens-base foram geradas em resolução menor (cenário: 1672 × 941; personagens: 1536 × 1024 e 1254 × 1254). A exportação 4K amplia esses elementos. O cenário não possui detalhe nativo de uma renderização 4K.

O movimento do corpo e a mudança de pose são feitos por deformação e composição das imagens. Para obter movimentos anatômicos em 3D e atuação facial mais elaborada, será necessário modelagem/rigging ou um serviço de geração de vídeo. A integração Runway apresentou exigência de plano pago na sessão; nenhum plano foi contratado.

## Arquivos

- `src/animation/aquariumScene.ts`: cronologia e desenho compartilhado entre site e exportação.
- `src/components/AquariumBackground.tsx`: ciclo de vida e controle do fundo.
- `public/media/aquarium/`: cenário, duas poses com transparência e poster.
- `aquarium-preview.html`: prévia em tela cheia.

Para exportar localmente, instalar o complemento opcional `npm install --no-save --package-lock=false --legacy-peer-deps @napi-rs/canvas@1.0.11` e executar `node scripts/render-aquarium.mjs`. O complemento serve apenas à exportação; o site usa o Canvas nativo do navegador. Para 4K, definir `AQUARIUM_WIDTH=3840` no ambiente antes do comando. Requer Node com suporte a TypeScript nativo e FFmpeg no PATH. `--stills` exporta quadros de inspeção e compara os quadros de 0 e 30 segundos. A resolução de saída e a pasta podem ser definidas por `AQUARIUM_WIDTH` e `AQUARIUM_OUTPUT`.

As imagens foram criadas com o gerador de imagens integrado. Prompts: remover o tubarão do cenário mantendo a quadra; extrair a mesma identidade de tubarão de perfil com transparência; gerar uma pose frontal da mesma identidade com transparência. O primeiro quadro sem bola serviu como referência para os três elementos.
