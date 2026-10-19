import type { Express } from 'express';
import { adminDatabase } from './firebaseAdmin';
import { addDays, arenaDate, buildArenaAvailability, minutes, validDate, type Occupancy, type AvailabilityBlock } from '../src/services/bookingAvailability';
import type { TenantConfig } from '../src/types';

export function registerBookingRoutes(app: Express, getDatabase = adminDatabase) {
  app.get('/api/booking/availability', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { tenantId, date } = req.query;
    if (typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId) || typeof date !== 'string' || !validDate(date)) {
      res.status(400).json({ error: 'Arena ou data inválida.' }); return;
    }
    try {
      const db = getDatabase();
      const config = await db.collection('arenas').doc(tenantId).get();
      const arena = config.data() as TenantConfig & { bookingHorizonDays?: number; timeZone?: string };
      if (!config.exists || !Array.isArray(arena.courts) || !arena.operatingHours) {
        res.status(503).json({ error: 'Agenda online ainda não configurada pela arena. Consulte a arena para verificar disponibilidade.' }); return;
      }
      if (!arena.courts.every(c => typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.sports) && c.sports.length > 0 && Number.isFinite(c.hourlyRate) && c.hourlyRate >= 0 &&
        Number.isFinite(minutes(c.openTime || arena.operatingHours.open)) && Number.isFinite(minutes(c.closeTime || arena.operatingHours.close)) &&
        (c.classSchedules || []).every(s => Array.isArray(s.daysOfWeek) && s.daysOfWeek.every(d => Number.isInteger(d) && d >= 0 && d <= 6) && minutes(s.startTime) < minutes(s.endTime)))) {
        res.status(503).json({ error: 'A configuração da agenda precisa ser revisada pela arena.' }); return;
      }
      const today = arenaDate(new Date(), arena.timeZone);
      // Seven days is the existing supported horizon; extend only after configuring the server.
      const horizonDays = Math.min(90, Math.max(1, Math.floor(arena.bookingHorizonDays || 7)));
      const maxDate = addDays(today, horizonDays - 1);
      if (date < today || date > maxDate) { res.status(400).json({ error: 'Data fora da janela de agendamento.', maxDate }); return; }
      const [bookings, blocks] = await Promise.all([
        db.collection('bookings').where('tenantId', '==', tenantId).where('date', '==', date).get(),
        db.collection('booking_blocks').where('tenantId', '==', tenantId).where('date', '==', date).get(),
      ]);
      const reservations = bookings.docs.map(doc => doc.data() as Occupancy);
      const administrativeBlocks = blocks.docs.map(doc => doc.data() as AvailabilityBlock);
      if (reservations.some(b => !['confirmed', 'pending', 'cancelled', 'expired'].includes(b.status)) ||
        [...reservations.filter(b => b.status === 'confirmed' || b.status === 'pending'), ...administrativeBlocks].some(b =>
          typeof b.courtId !== 'string' || !(minutes(b.startTime) < minutes(b.endTime)))) {
        res.status(503).json({ error: 'A agenda contém um registro inconsistente. A arena precisa revisá-lo.' }); return;
      }
      const cells = buildArenaAvailability({ ...arena, id: tenantId }, date,
        reservations, {
          horizonDays, timeZone: arena.timeZone,
          blocks: administrativeBlocks,
        });
      res.json({ cells, maxDate, today, timeZone: arena.timeZone || 'America/Sao_Paulo' });
    } catch (error) {
      console.error('Availability lookup failed', error instanceof Error ? error.message : 'Unknown error');
      res.status(503).json({ error: 'Não foi possível verificar a disponibilidade. Tente novamente.' });
    }
  });
  // No provider is configured. Fail closed: no lock, booking, charge or financial confirmation.
  app.post('/api/booking/checkout', (_req, res) => {
    res.status(503).json({ error: 'Pagamento online indisponível. Combine a reserva diretamente com a arena.' });
  });
}
