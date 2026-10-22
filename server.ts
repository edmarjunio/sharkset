import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createServer } from 'node:http';
import 'dotenv/config';
import { registerInactivityRoutes } from './server/inactivity';
import { registerBroadcastRoutes } from './server/broadcasts';
import { registerBookingRoutes } from './server/bookings';
import { registerLivekitProxy } from './server/livekitProxy';
import { registerWhatsAppRoutes } from './server/whatsapp';
import { registerTournamentLiveStateRoutes } from './server/tournamentLiveStates';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um nÃºmero inteiro entre 1 e 65535.');
  }
  const httpServer = createServer(app);
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    let pathname: string;
    try { pathname = decodeURIComponent(req.path).replaceAll('\\', '/'); }
    catch { res.sendStatus(400); return; }
    if (pathname.split('/').includes('technical_table')) { res.sendStatus(404); return; }
    next();
  });
  registerInactivityRoutes(app);
  registerBroadcastRoutes(app);
  registerBookingRoutes(app);
  registerLivekitProxy(app);
  registerWhatsAppRoutes(app);
  registerTournamentLiveStateRoutes(app);

  // Health output contains service status only; it never reports process-local audience counts.
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SHARKSET API',
      timestamp: new Date().toISOString(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { setHeaders(res, file) {
      const relative = path.relative(distPath, file).replaceAll('\\', '/');
      res.setHeader('Cache-Control', relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : relative.startsWith('brand/') ? 'public, max-age=3600, must-revalidate' : 'no-cache');
    } }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, '0.0.0.0', resolve);
    });
    console.log(`SHARKSET disponÃ­vel em http://localhost:${port}`);
  } catch (error) {
    await vite?.close();
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      throw new Error(`A porta ${port} jÃ¡ estÃ¡ ocupada. Encerre a outra instÃ¢ncia do SHARKSET ou configure PORT no .env.`);
    }
    throw error;
  }
}

startServer().catch(error => {
  console.error(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel iniciar o SHARKSET.');
  process.exitCode = 1;
});
