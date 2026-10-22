# Modelo de segurança

## Controles no código

- Firebase Auth associa as operações ao UID autenticado.
- Admin global é verificado por e-mail legado, custom claim `platformAdmin` ou `admins/{uid}`. Donos e gestores de arena têm acesso limitado à arena correspondente.
- Saldo de tokens e documentos de pagamento só são gravados por Cloud Functions com Admin SDK.
- O webhook do Mercado Pago valida `x-signature` e consulta o pagamento na API do provedor antes de alterar saldo.
- Criação de campeonato e débito do token ocorrem na mesma transação.
- Curtidas de publicações são idempotentes por usuário.

## Pendências antes de considerar produção

- Cadastrar `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` no Secret Manager.
- Publicar Functions e as regras Firestore atualizadas.
- Executar a suíte de regras do Firebase Emulator para isolamento de arena e proteção do saldo.
- Publicar/verificar o Cloud Run `sharkset-api`, exigido pelo rewrite `/api/**` no Hosting.
- Implementar operações autoritativas para reservas e ranking e associar cada live a uma reserva ou partida.
- Migrar dados legados do `localStorage` com identificação do dono antes de remover a fonte local.

Nunca colocar chaves do Mercado Pago em variáveis `VITE_*`, bundle, `localStorage`, documentação pública ou Git.
