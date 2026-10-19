import type { Express } from 'express';
import { adminDatabase } from './firebaseAdmin';
import { addDays, arenaDate, buildArenaAvailability, minutes, validDate, type Occupancy, type AvailabilityBlock } from '../src/services/bookingAvailability';
import type { TenantConfig } from '../src/types';

export function registerBookingRoutes(app: Express, getDatabase = adminDatabase) {
  const readAvailability = async (tenantId: unknown, date: unknown): Promise<{ status: number; body: Record<string, unknown> }> => {
    if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId) || typeof date !== 'string' || !validDate(date)) {
      return { status: 400, body: { error: 'Arena ou data inválida.' } };
    }
    try {
      const db = getDatabase();
      const config = await db.collection('arenas').doc(tenantId).get();
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
      const [bookings, blocks] = await Promise.all([
        db.collection('bookings').where('tenantId', '==', tenantId).where('date', '==', date).get(),
        db.collection('booking_blocks').where('tenantId', '==', tenantId).where('date', '==', date).get(),
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
    } catch (error) {
      console.error('Availability lookup failed', error instanceof Error ? error.message : 'Unknown error');
      return { status: 503, body: { error: 'Não foi possível verificar a disponibilidade. Tente novamente.' } };
    }
  };
  app.get('/api/booking/availability', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await readAvailability(req.query.tenantId, req.query.date);
    res.status(result.status).json(result.body);
  });
  app.get('/api/booking/stream', (req, res) => {
    const { tenantId, date } = req.query;
    if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId) || typeof date !== 'string' || !validDate(date)) {
      res.status(400).json({ error: 'Arena ou data inválida.' }); return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 15000\n\n');
    let closed = false, sequence = 0;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: (() => void)[] = [];
    const emit = (event: string, body: unknown) => { if (!closed) res.write('event: ' + event + '\ndata: ' + JSON.stringify(body) + '\n\n'); };
    // Reuse the exact validated public projection from the HTTP route.
    const publish = async () => {
      const revision = ++sequence;
      const result = await readAvailability(tenantId, date);
      if (revision === sequence) emit(result.status === 200 ? 'availability' : 'availability-error', result.body);
    };
    const schedule = () => { if (debounce) clearTimeout(debounce); debounce = setTimeout(() => { void publish(); }, 75); };
    const tick = setInterval(() => { void publish(); }, 30000);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(tick);
      if (debounce) clearTimeout(debounce);
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
    const fail = () => {
      if (closed) return;
      emit('availability-error', { error: 'A conexão com a agenda foi interrompida. Reconectando…' });
      cleanup();
      res.end();
    };
    req.on('close', cleanup);
    try {
      const db = getDatabase();
      unsubscribers.push(db.collection('arenas').doc(tenantId).onSnapshot(schedule, fail));
      for (const name of ['bookings', 'booking_blocks']) {
        unsubscribers.push(db.collection(name).where('tenantId', '==', tenantId).where('date', '==', date).onSnapshot(schedule, fail));
      }
    } catch { fail(); }
  });
  // No provider is configured. Fail closed: no lock, booking, charge or financial confirmation.
  app.post('/api/booking/checkout', (_req, res) => {
    res.status(503).json({ error: 'Pagamento online indisponível. Combine a reserva diretamente com a arena.' });
  });
}
