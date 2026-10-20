const recentReports = new Set<string>();

export function reportUnexpectedError(error: unknown, context = 'interface'): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const message = `${context} | ${window.location.pathname} | ${detail}`.slice(0, 1000);
  const key = message;
  if (recentReports.has(key)) return;
  recentReports.add(key);
  window.setTimeout(() => recentReports.delete(key), 5 * 60_000);
  void fetch('/api/notifications/whatsapp/error-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    keepalive: true,
  }).catch((reportError) => console.warn('Não foi possível enviar o relatório ao WhatsApp.', reportError));
}
