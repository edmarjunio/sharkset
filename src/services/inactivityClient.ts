import { auth } from '../lib/firebase';

export async function checkPlayerInactivity(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  const response = await fetch('/api/ranking/inactivity/check', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('A verificação de inatividade está indisponível.');
}
