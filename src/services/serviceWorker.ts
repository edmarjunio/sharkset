export function registerStaticWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(registration => {
      // New versions wait for existing tabs to close; never reload an active match/player.
      window.addEventListener('online', () => { void registration.update().catch(() => {}); });
    }).catch(error => console.warn('Cache estático indisponível:', error instanceof Error ? error.name : 'unknown'));
  }, { once: true });
}
