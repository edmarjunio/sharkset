# Modelo de segurança

## Controles observados

- Firestore Rules usa negação global por padrão e regras explícitas por coleção.
- Firebase Auth fornece UID; perfis privados são associados ao proprietário.
- API de lives valida ID token e usa revisão transacional para atualização concorrente.
- Functions LiveKit são privadas para a identidade do gateway e validam o bearer recebido.
- Reserva online falha fechada com 503, e não declara pagamento confirmado.

## Riscos pendentes

- Admin SDK ignora Firestore Rules: cada endpoint servidor precisa validar token, papel, arena e campos.
- O Express não está configurado como backend de Hosting/Cloud Run. Endpoints locais não comprovam segurança nem disponibilidade em produção.
- O mecanismo de administrador nas Rules mantém e-mail específico como exceção, além do documento `admins/{uid}`; remover essa dependência requer provisionamento testado.
- Subcoleções de arena, leitura pública e campos protegidos exigem testes de Rules para cada perfil e isolamento cruzado.
- App Check não está integrado de forma abrangente.
- Pagamentos, webhooks, operações de reserva e ranking oficial dependem de backend autoritativo ainda incompleto.

## Requisitos de publicação

Executar testes do Firebase Emulator Suite para duas arenas e papéis distintos; revisar acesso de leitura e escrita a campos; validar IAM de cada serviço; manter segredos fora do frontend e do repositório. Nenhuma regra foi alterada nesta etapa, pois uma mudança geral poderia interromper fluxos existentes sem matriz completa de compatibilidade.
