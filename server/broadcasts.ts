import type { Express } from 'express';
import { adminDatabase, authenticatedUser } from './firebaseAdmin';
import { FieldPath } from 'firebase-admin/firestore';
import { liveDistance, matchesLiveLocation, type LiveLocation } from '../src/services/liveDirectory';

function validScoreboard(data: Record<string, unknown>) {
  return ['score1', 'score2', 'sets1', 'sets2', 'elapsedSeconds'].every(key =>
    Number.isInteger(data[key]) && Number(data[key]) >= 0 && Number(data[key]) <= (key === 'elapsedSeconds' ? 86400 : 999)) &&
    [1, 3, 5].includes(Number(data.bestOf)) &&
    Number(data.sets1) <= Math.ceil(Number(data.bestOf) / 2) && Number(data.sets2) <= Math.ceil(Number(data.bestOf) / 2) &&
    (data.clockStartedAt === null || (Number.isSafeInteger(data.clockStartedAt) && Number(data.clockStartedAt) <= Date.now()));
}

export function registerBroadcastRoutes(app: Express, getDatabase = adminDatabase) {
  app.get('/api/broadcasts', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const mode = String(req.query.mode || 'nearby');
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const lat = req.query.lat === undefined ? NaN : Number(req.query.lat);
    const lng = req.query.lng === undefined ? NaN : Number(req.query.lng);
    const cursor = req.query.cursor;
    if (!['nearby', 'city', 'all'].includes(mode) || (mode === 'city' && (!city || city.length > 100 || state.length > 50)) ||
      (mode === 'nearby' && (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180)) ||
      (cursor !== undefined && (typeof cursor !== 'string' || !/^[\w-]{1,128}$/.test(cursor)))) {
      res.status(400).json({ error: 'Informe uma localização ou filtro válido.' }); return;
    }
    try {
      const db = getDatabase();
      let pageQuery = db.collection('broadcasts').where('isLive', '==', true).orderBy(FieldPath.documentId()).limit(12);
      if (cursor) pageQuery = pageQuery.startAfter(cursor);
      const page = await pageQuery.get();
      const arenaIds = [...new Set(page.docs.map(item => item.data().arenaId).filter((id): id is string => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)))];
      const arenas = arenaIds.length ? await db.getAll(...arenaIds.map(id => db.collection('arenas').doc(id))) : [];
      const arenaMap = new Map(arenas.map(item => [item.id, item.data()]));
      const items = page.docs.flatMap(item => {
        const data = item.data();
        const arena = arenaMap.get(data.arenaId);
        const location: LiveLocation = arena || {};
        if (typeof data.videoUrl !== 'string' || !/^https:\/\//i.test(data.videoUrl) || !matchesLiveLocation(location, { mode, city, state, lat, lng })) return [];
        return [{ id: item.id, title: String(data.title || 'Transmissão ao vivo'), city: location.city || '', state: location.state || '',
          arenaName: arena?.name || '', distanceKm: mode === 'nearby' ? liveDistance(location, lat, lng) : null }];
      });
      res.json({ items, nextCursor: page.size === 12 ? page.docs[page.docs.length - 1].id : null });
    } catch {
      res.status(503).json({ error: 'Não foi possível consultar as transmissões. Tente novamente.' });
    }
  });
  app.post('/api/broadcasts', async (req, res) => {
    try {
      const user = await authenticatedUser(req);
      const { arenaId, title } = req.body;
      if (typeof title !== 'string' || !title.trim() || title.length > 100 || (arenaId && !/^[\w-]{1,64}$/.test(arenaId))) {
        res.status(400).json({ error: 'Informe um título de até 100 caracteres.' }); return;
      }
      const db = adminDatabase();
      if (arenaId) {
        const arena = (await db.collection('arenas').doc(arenaId).get()).data();
        if (arena?.ownerId !== user.uid) { res.status(403).json({ error: 'Apenas o responsável pela arena pode transmitir nesta página.' }); return; }
      }
      const ref = db.collection('broadcasts').doc();
      const data = { id: ref.id, ownerId: user.uid, arenaId: arenaId || null, title: title.trim(),
        team1: 'Dupla 1', team2: 'Dupla 2', score1: 0, score2: 0, sets1: 0, sets2: 0,
        bestOf: 1, elapsedSeconds: 0, clockStartedAt: null, videoUrl: '', isLive: false,
        rankingEligible: false, revision: 0, createdAt: new Date().toISOString() };
      await ref.create(data);
      res.status(201).json(data);
    } catch { res.status(401).json({ error: 'Entre na sua conta para criar a transmissão.' }); }
  });

  app.patch('/api/broadcasts/:id', async (req, res) => {
    try {
      const user = await authenticatedUser(req);
      const id = String(req.params.id);
      if (!/^[\w-]{1,64}$/.test(id)) { res.status(400).json({ error: 'Transmissão inválida.' }); return; }
      const { revision, ...patch } = req.body;
      const allowed = new Set(['score1', 'score2', 'sets1', 'sets2', 'bestOf', 'elapsedSeconds', 'clockStartedAt', 'isLive', 'videoUrl', 'team1', 'team2']);
      if (!Object.keys(patch).every(key => allowed.has(key)) || !Number.isInteger(revision)) {
        res.status(400).json({ error: 'Alteração inválida.' }); return;
      }
      const db = adminDatabase();
      await db.runTransaction(async transaction => {
        const ref = db.collection('broadcasts').doc(id);
        const previous = (await transaction.get(ref)).data();
        if (!previous || previous.ownerId !== user.uid) throw new Error('FORBIDDEN');
        if (previous.revision !== revision) throw new Error('CONFLICT');
        const next = { ...previous, ...patch };
        if (!validScoreboard(next) || typeof next.isLive !== 'boolean' ||
          !['team1', 'team2'].every(key => typeof next[key] === 'string' && next[key].length <= 80)) throw new Error('INVALID');
        if (typeof next.videoUrl !== 'string' || next.videoUrl.length > 2048 ||
          (next.videoUrl && new URL(next.videoUrl).protocol !== 'https:') || (next.isLive && !next.videoUrl)) throw new Error('INVALID');
        transaction.update(ref, { ...patch, revision: revision + 1, updatedAt: new Date().toISOString() });
      });
      res.json({ ok: true, revision: revision + 1 });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      res.status(code === 'CONFLICT' ? 409 : code === 'INVALID' ? 400 : 403)
        .json({ error: code === 'CONFLICT' ? 'O placar mudou em outro dispositivo. Confira o placar e tente novamente.' : 'Não foi possível atualizar a transmissão. Confira os dados e sua permissão.' });
    }
  });
}
