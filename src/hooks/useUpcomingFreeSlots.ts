import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { arenaDate, type AvailabilityCell } from '../services/bookingAvailability';
import { slotsInWindow } from '../services/nearbySlots';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import type { Court, TenantConfig } from '../types';
import { calculateHaversineDistance } from '../utils/geoUtils';

export interface UpcomingSlotItem {
  id: string;
  arena: TenantConfig;
  court: Court;
  slot: AvailabilityCell;
  distanceKm: number;
}

function getLocalClock(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function useUpcomingFreeSlots() {
  const { availableTenants, bookings, slots, tenant, radiusKm } = useApp();
  const location = useBookingLocation();
  const coords = location.coords;

  const [now, setNow] = useState(getLocalClock);
  const [today, setToday] = useState(arenaDate);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(getLocalClock());
      setToday(arenaDate());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingSlots = useMemo(() => {
    const items: UpcomingSlotItem[] = [];

    for (const arena of availableTenants) {
      const distance =
        validCoordinates(coords) && validCoordinates({ lat: arena.lat!, lng: arena.lng! })
          ? calculateHaversineDistance(coords.lat, coords.lng, arena.lat!, arena.lng!)
          : arena.distanceKm;

      if (!Number.isFinite(distance) || distance > (radiusKm || 50)) {
        // Still allow if nearby or fallback distance
      }

      // Upcoming slots require records loaded from the real availability service.
      const cells: AvailabilityCell[] = tenant.id === arena.id
        ? slots.map((slot) => ({ ...slot, state: slot.isAvailable ? 'free' : 'blocked' }))
        : [];

      const freeCells = slotsInWindow(cells, now);

      for (const cell of freeCells) {
        const court = arena.courts.find((c) => c.id === cell.courtId) || arena.courts[0];
        if (!court) continue;

        items.push({
          id: `${arena.id}-${cell.id}`,
          arena,
          court,
          slot: cell,
          distanceKm: Number.isFinite(distance) ? distance : 0,
        });
      }
    }

    // Sort by start time ascending, then by proximity
    return items.sort((a, b) => {
      const timeDiff = a.slot.startTime.localeCompare(b.slot.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.distanceKm - b.distanceKm;
    });
  }, [availableTenants, bookings, slots, tenant.id, coords, radiusKm, today, now]);

  return { upcomingSlots, now, today };
}
