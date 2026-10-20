import type { Express } from 'express';

/** Development only: private Functions emulator. Never reads production secrets. */
export function registerLivekitProxy(app: Express) {
  app.use('/api/livekit', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (process.env.NODE_ENV === 'production' || process.env.LIVEKIT_EMULATOR_PROXY !== 'true') {
      res.status(503).json({ error: 'LIVEKIT_EMULATOR_NOT_ENABLED' }); return;
    }
    const action = req.path.split('/').filter(Boolean).pop();
    if (!['start', 'viewer', 'confirm', 'stop', 'status', 'directory'].includes(action || '')) { res.sendStatus(404); return; }
    if ((action === 'directory' && req.method !== 'GET') || (action !== 'directory' && req.method !== 'POST')) { res.sendStatus(405); return; }
    const fn = action === 'directory' ? 'livekitDirectory' : 'livekitSession';
    try {
      const response = await fetch(`http://127.0.0.1:5001/sharkset-70de4/us-central1/${fn}/api/livekit/${action}${new URL(req.originalUrl, 'http://localhost').search}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) },
        ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}), signal: AbortSignal.timeout(30_000),
      });
      res.status(response.status).type('application/json').send(await response.text());
    } catch { res.status(503).json({ error: 'LIVEKIT_EMULATOR_UNAVAILABLE' }); }
  });
}
