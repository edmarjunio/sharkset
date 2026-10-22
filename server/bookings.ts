import type { Express } from 'express';
import { adminDatabase } from './firebaseAdmin';
import { addDays, arenaDate, buildArenaAvailability, minutes, validDate, type Occupancy, type AvailabilityBlock } from '../src/services/bookingAvailability';
import type { TenantConfig } from '../src/types';

interface AvailabilityRecords {
  config: { exists: boolean; data(): unknown };
  bookings: { docs: Array<{ data(): unknown }> };
  blocks: { docs: Array<{ data(): unknown }> };
}

export function registerBookingRoutes(app: Express, getDatabase = adminDatabase) {
  const readAvailability = async (tenantId: unknown, date: unknown, records?: AvailabilityRecords): Promise<{ status: number; body: Record<string, unknown> }> => {
    if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId) || typeof date !== 'string' || !validDate(date)) {
      return { status: 400, body: { error: 'Arena ou data inválida.' } };
    }
    try {
      const db = records ? undefined : getDatabase();
      const config = records?.config || await db!.collection('arenas').doc(tenantId).get();
      const arena = config.data() as TenantConfig & { bookingHorizonDays?: number; timeZone?: string };
      if (!config.exists || !Array.isArray(arena.courts) || !arena.operatingHours) {
        return { status: 503, body: { error: 'Agenda online ainda não configurada pela arena. Consulte a arena para verificar disponibilidade.' } };
      }
      if (!arena.courts.every(c => typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.sports) && c.sports.length > 0 && Number.isFinite(c.hourlyRate) && c.hourlyRate >= 0 &&
        Number.isFinite(minutes(c.openTime || arena.operatingHours.open)) && Number.isFinite(minutes(c.closeTime || arena.operatingHours.close)) &&
        (c.classSchedules || []).every(s => Array.isArray(s.daysOfWeek) && s.daysOfWeek.every(d => Number.isInteger(d) && d >= 0 && d <= 6) && minutes(s.startTime) < minutes(s.endTime)))) {
        return { status: 503, body: { error: 'A configuração da agenda precisa ser revisada pela arena.' } };
      }
      const today = arenaDate(new Date(), arena.timeZone);
      // Seven days is the existing supported horizon; extend only after configuring the server.
      const horizonDays = Math.min(90, Math.max(1, Math.floor(arena.bookingHorizonDays || 7)));
      const maxDate = addDays(today, horizonDays - 1);
      if (date < today || date > maxDate) { return { status: 400, body: { error: 'Data fora da janela de agendamento.', maxDate } }; }
      const [bookings, blocks] = records ? [records.bookings, records.blocks] : await Promise.all([
        db!.collection('bookings').where('tenantId', '==', tenantId).where('date', '==', date).get(),
        db!.collection('booking_blocks').where('tenantId', '==', tenantId).where('date', '==', date).get(),
      ]);
      const reservations = bookings.docs.map(doc => doc.data() as Occupancy);
      const administrativeBlocks = blocks.docs.map(doc => doc.data() as AvailabilityBlock);
      if (reservations.some(b => !['confirmed', 'pending', 'cancelled', 'expired'].includes(b.status)) ||
        [...reservations.filter(b => b.status === 'confirmed' || b.status === 'pending'), ...administrativeBlocks].some(b =>
          typeof b.courtId !== 'string' || !(minutes(b.startTime) < minutes(b.endTime)))) {
        return { status: 503, body: { error: 'A agenda contém um registro inconsistente. A arena precisa revisá-lo.' } };
      }
      const cells = buildArenaAvailability({ ...arena, id: tenantId }, date,
        reservations, {
          horizonDays, timeZone: arena.timeZone,
          blocks: administrativeBlocks,
        });
      return { status: 200, body: { cells, maxDate, today, timeZone: arena.timeZone || 'America/Sao_Paulo' } };
    } catch {
      return { status: 503, body: { error: 'Não foi possível verificar a disponibilidade. Tente novamente.' } };
    }
  };
  app.get('/api/booking/availability', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await readAvailability(req.query.tenantId, req.query.date);
    res.status(result.status).json(result.body);
  });
  // One upstream subscription set per arena/date, shared by this process's viewers.
  const channels = new Map<string, {
    clients: Set<import('express').Response>; stop: () => void; last?: string;
  }>();
  app.get('/api/booking/stream', (req, res) => {
    const { tenantId, date } = req.query;
    if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId) || typeof date !== 'string' || !validDate(date)) {
      res.status(400).json({ error: 'Arena ou data inválida.' }); return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders(); res.write('retry: 15000\n\n');
    const key = tenantId + ':' + date;
    let channel = channels.get(key);
    if (channel) {
      channel.clients.add(res);
      if (channel.last) res.write(channel.last);
    } else {
      channel = { clients: new Set([res]), stop: () => {} }; channels.set(key, channel);
      const target = channel;
      let closed = false;
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const unsubscribers: (() => void)[] = [];
      const records: Partial<AvailabilityRecords> = {};
      const emit = (event: string, body: unknown) => {
        if (closed) return;
        const message = 'event: ' + event + '\ndata: ' + JSON.stringify(body) + '\n\n';
        if (event === 'availability') target.last = message;
        for (const client of target.clients) client.write(message);
      };
      const publish = async () => {
        if (!records.config || !records.bookings || !records.blocks || closed) return;
        const result = await readAvailability(tenantId, date, records as AvailabilityRecords);
        emit(result.status === 200 ? 'availability' : 'availability-error', result.body);
      };
      const schedule = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => { void publish(); }, 75);
      };
      // Recompute time-dependent slot expiry from the same snapshots; no Firestore reads.
      const tick = setInterval(() => { void publish(); }, 30_000);
      target.stop = () => {
        if (closed) return;
        closed = true; clearInterval(tick); clearTimeout(debounce);
        unsubscribers.forEach(unsubscribe => unsubscribe()); channels.delete(key);
      };
      const fail = () => {
        emit('availability-error', { error: 'A conexão com a agenda foi interrompida. Reconectando.' });
        const clients = [...target.clients]; target.stop(); clients.forEach(client => client.end());
      };
      try {
        const db = getDatabase();
        unsubscribers.push(db.collection('arenas').doc(tenantId).onSnapshot(snapshot => { records.config = snapshot; schedule(); }, fail));
        unsubscribers.push(db.collection('bookings').where('tenantId', '==', tenantId).where('date', '==', date).onSnapshot(snapshot => { records.bookings = snapshot; schedule(); }, fail));
        unsubscribers.push(db.collection('booking_blocks').where('tenantId', '==', tenantId).where('date', '==', date).onSnapshot(snapshot => { records.blocks = snapshot; schedule(); }, fail));
      } catch { fail(); }
    }
    const target = channel;
    req.on('close', () => { target.clients.delete(res); if (!target.clients.size) target.stop(); });
  });
  // No provider is configured. Fail closed: no lock, booking, charge or financial confirmation.
  app.post('/api/booking/checkout', (_req, res) => {
    res.status(503).json({ error: 'Pagamento online indisponível. Combine a reserva diretamente com a arena.' });
  });
}
