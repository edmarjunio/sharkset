# Guia de publicacao

## Estado da producao

O deploy de Firestore concluiu regras e indices. O Hosting nao concluiu porque o servico Cloud Run `sharkset-api` ainda nao existia. O primeiro build da imagem compilou, mas o push falhou porque o repositorio Artifact Registry `sharkset` nao foi criado. Use os comandos abaixo no PowerShell. Nao use `\` como continuacao de linha no PowerShell.

## Cloud Run

Execute na raiz do projeto. Criar um repositorio e um service account sao passos de uma vez; se ja existirem, pule apenas as linhas de criacao.

```powershell
gcloud config set project sharkset-70de4
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create sharkset --repository-format=docker --location=southamerica-east1
gcloud iam service-accounts create sharkset-api --display-name="SHARKSET API"
gcloud projects add-iam-policy-binding sharkset-70de4 --member="serviceAccount:sharkset-api@sharkset-70de4.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud builds submit --tag southamerica-east1-docker.pkg.dev/sharkset-70de4/sharkset/sharkset-api:latest .
gcloud run deploy sharkset-api --image=southamerica-east1-docker.pkg.dev/sharkset-70de4/sharkset/sharkset-api:latest --region=southamerica-east1 --project=sharkset-70de4 --port=8080 --service-account=sharkset-api@sharkset-70de4.iam.gserviceaccount.com --allow-unauthenticated --set-env-vars=GOOGLE_CLOUD_PROJECT=sharkset-70de4
```

O build usa `node:24-slim`, pois as versoes Firebase deste lockfile declaram Node `>=24.12.0`. Cloud Run usa Application Default Credentials; nao crie nem envie chave JSON. O servico precisa aceitar invocacoes do Hosting. As rotas que acessam dados privados validam Firebase ID token e permissao no backend. Envio WhatsApp generico e alertas de torneio/resultado permanecem indisponiveis ate contatos e consentimentos terem fonte verificavel no servidor.

Confirme que o servico esta `Ready` no Cloud Run e que `/api/health` responde `{"status":"ok"}` na URL do servico.

## Hosting

Com o servico Cloud Run criado em `southamerica-east1`, publique apenas o frontend:

```powershell
firebase deploy --only hosting --project sharkset-70de4
```

Antes do Hosting, configure e publique as Functions e as regras atualizadas:

```powershell
firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_SECRET
firebase deploy --only firestore:rules,functions --project sharkset-70de4
```

Configure também o Webhook da aplicação Mercado Pago para `https://us-central1-sharkset-70de4.cloudfunctions.net/mercadoPagoWebhook`, com eventos de pagamento. Veja [MERCADO_PAGO_TOKENS.md](MERCADO_PAGO_TOKENS.md) para o fluxo e os preços.

Depois que Functions e Cloud Run estiverem `Ready`, publique Hosting. Confira login Google, criação do perfil, compra aprovada de token, saldo refletido no perfil, criação de campeonato e autorização de posts. A agenda online e o vínculo obrigatório de live com partida continuam pendentes de implementação.

## Regras e indices

Rules e índices anteriores foram publicados pelo proprietário no deploy relatado. As regras desta versão alteram escritas de torneio, perfil e posts; publique-as junto com as Functions correspondentes. Não inclua `--only firestore` se não quiser sincronizar/excluir índices do projeto.
