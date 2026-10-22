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

interface LiveMatchPayload {
  matchId: string;
  tournamentId: string;
  score1: number;
  score2: number;
  status: string;
  liveReferee?: unknown;
  updatedAt: string;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um nÃºmero inteiro entre 1 e 65535.');
  }
  const httpServer = createServer(app);
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json());
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

  // Authoritative in-memory store for real-time live matches + connected SSE clients
  const liveMatchesState = new Map<string, LiveMatchPayload>();
  const sseClients = new Set<express.Response>();

  function broadcastEvent(eventName: string, payload: unknown) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Clean Code API: Health & Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SHARK SET Backend Engine',
      connectedSpectators: sseClients.size,
      timestamp: new Date().toISOString(),
    });
  });

  // Real-Time Server-Sent Events (SSE) Stream for Live Bracket Spectators & Referees
  app.get('/api/live-matches/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial authoritative snapshot
    const initialSnapshot = Array.from(liveMatchesState.values());
    res.write(`event: init\ndata: ${JSON.stringify({ matches: initialSnapshot, spectators: sseClients.size + 1 })}\n\n`);

    sseClients.add(res);
    broadcastEvent('presence', { spectators: sseClients.size });

    req.on('close', () => {
      sseClients.delete(res);
      broadcastEvent('presence', { spectators: sseClients.size });
    });
  });

  // Real-Time Referee Score / Service Order / Timeout Broadcast Endpoint
  app.post('/api/live-matches/broadcast', (req, res) => {
    const payload = req.body as LiveMatchPayload;
    if (!payload || !payload.matchId) {
      res.status(400).json({ error: 'Missing matchId in payload' });
      return;
    }

    const authoritativeRecord: LiveMatchPayload = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    liveMatchesState.set(payload.matchId, authoritativeRecord);

    broadcastEvent('match:updated', authoritativeRecord);
    res.status(200).json({ ok: true, broadcastedTo: sseClients.size, match: authoritativeRecord });
  });

  // Clean Code API: Push Notification & Smart Alert Dispatch Endpoint
  app.post('/api/notifications/dispatch', (req, res) => {
    const { type, title, body, recipientName, recipientPhone } = req.body || {};
    if (!type || !title || !body) {
      res.status(400).json({ error: 'Missing required notification fields (type, title, body).' });
      return;
    }

    const notificationRecord = {
      dispatched: true,
      id: `push-${Date.now()}`,
      type,
      title,
      body,
      recipientName: recipientName || 'Atleta SHARK SET',
      recipientPhone: recipientPhone || '',
      deliveredAt: new Date().toISOString(),
    };

    broadcastEvent('notification:dispatched', notificationRecord);
    res.status(200).json(notificationRecord);
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
