import { auth } from '../lib/firebase';

const errors: Record<string, string> = {
  AUTH_REQUIRED: 'Entre na sua conta para continuar.', ARENA_FORBIDDEN: 'Somente gestores autorizados desta arena podem transmitir.',
  ARENA_NOT_FOUND: 'A arena ainda não está cadastrada no backend.', LIVE_ALREADY_ACTIVE: 'Já existe uma transmissão ativa nesta arena.',
  LIVE_NOT_FOUND: 'Esta transmissão não está disponível.', CAMERA_NOT_PUBLISHED: 'A câmera ainda não foi confirmada no servidor.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto.', LIVE_EXPIRED: 'A sessão expirou. Inicie uma nova transmissão.',
  STOP_RETRY_REQUIRED: 'A divulgação foi suspensa, mas o encerramento precisa ser repetido.',
  ISSUER_DISCLOSURE_DISABLED: 'A transmissão aguarda autorização da configuração de segurança dos tokens.',
};
export function publicLivekitUrl() {
  const value = import.meta.env.VITE_LIVEKIT_PUBLIC_URL;
  if (!value) throw new Error('Transmissão por câmera em configuração. Falta o endereço público WebRTC.');
  const url = new URL(value);
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) throw new Error('Endereço público da transmissão inválido.');
  return url.origin;
}
export function livekitApiPath(action: string) {
  const base = String(import.meta.env.VITE_LIVEKIT_API_BASE_URL || '').replace(/\/$/, '');
  if (base) {
    const url = new URL(base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Endereço da API de transmissão inválido.');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Informe somente a origem pública da API.');
  }
  return `${base}/api/livekit/${action}`;
}
export async function livekitRequest<T>(action: 'start' | 'viewer' | 'confirm' | 'stop' | 'status', body: { arenaId?: string; sessionId?: string }): Promise<T> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error(errors.AUTH_REQUIRED);
  const response = await fetch(livekitApiPath(action), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({ error: 'LIVE_UNAVAILABLE' }));
  if (!response.ok) throw new Error(errors[data.error] || 'Transmissão indisponível. Tente novamente.');
  return data as T;
}
