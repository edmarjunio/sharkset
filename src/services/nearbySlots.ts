import type { AvailabilityCell } from './bookingAvailability';
import { minutes } from './bookingAvailability';

export function slotsInWindow(cells: readonly AvailabilityCell[], now: string, from = '', to = '') {
  const start = Math.max(minutes(now), from ? minutes(from) : minutes(now));
  const end = to ? minutes(to) : from ? 1440 : Math.min(1440, start + 240);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];
  return cells.filter(c => c.state === 'free' && minutes(c.startTime) >= start && minutes(c.endTime) <= end)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.courtId.localeCompare(b.courtId));
}

/** Initial snapshots establish a baseline; only observed occupied-to-free transitions are alerts. */
export function newlyFreedSlots(previous: readonly AvailabilityCell[] | undefined, current: readonly AvailabilityCell[]) {
  if (!previous) return [];
  const old = new Map(previous.map(cell => [cell.id, cell.state]));
  return current.filter(cell => cell.state === 'free' && ['reserved', 'blocked', 'class'].includes(old.get(cell.id) || ''));
}
