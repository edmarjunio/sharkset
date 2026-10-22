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

Depois, confira o login Google, criacao de `user_profiles/{uid}`, disponibilidade de agenda e placar autenticado. Checkout segue fechado enquanto nao houver provedor de pagamento.

## Regras e indices

Rules e indices foram publicados pelo proprietario no deploy relatado. Para mudancas futuras, valide as Rules no Emulator Suite ou em staging antes de publicar. O projeto Firebase e o banco `(default)` estao confirmados pelo log.
