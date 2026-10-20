import { auth } from '../lib/firebase';

const INACTIVITY_CHECK_CACHE_KEY = 'sharkset_last_inactivity_check_at';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function checkPlayerInactivity(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  // FinOps & Anti-Spam protection: Check only once per day locally
  try {
    const lastChecked = localStorage.getItem(`${INACTIVITY_CHECK_CACHE_KEY}_${user.uid}`);
    if (lastChecked && Date.now() - Number(lastChecked) < ONE_DAY_MS) {
      return;
    }
  } catch {
    // ignore localStorage errors
  }

  const token = await user.getIdToken();
  const response = await fetch('/api/ranking/inactivity/check', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('A verificação de inatividade está indisponível.');

  try {
    localStorage.setItem(`${INACTIVITY_CHECK_CACHE_KEY}_${user.uid}`, String(Date.now()));
  } catch {
    // ignore
  }
}

