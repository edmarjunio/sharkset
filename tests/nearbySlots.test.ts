import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newlyFreedSlots, slotsInWindow } from '../src/services/nearbySlots';
import type { AvailabilityCell } from '../src/services/bookingAvailability';

const cells = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map((time, i) => ({
  id: String(i), courtId: i % 2 ? 'q1' : 'q2', date: '2026-10-19', startTime: time,
  endTime: String(17 + i) + ':00', state: 'free', isAvailable: true, price: 80,
})) as AvailabilityCell[];
test('nearby suggestions default to the next four hours, excluding elapsed starts', () => {
  assert.deepEqual(slotsInWindow(cells, '16:30').map(c => c.startTime), ['17:00', '18:00', '19:00']);
});
test('search interval contains the full slot and never includes the final boundary start', () => {
  assert.deepEqual(slotsInWindow(cells, '16:30', '18:00', '20:00').map(c => c.startTime), ['18:00', '19:00']);
  assert.deepEqual(slotsInWindow(cells, '16:30', '20:00', '18:00'), []);
  assert.deepEqual(slotsInWindow(cells, '18:15', '16:00', '20:00').map(c => c.startTime), ['19:00']);
});
test('initial free slots do not create fake newly-freed notifications', () => {
  assert.deepEqual(newlyFreedSlots(undefined, cells), []);
  assert.deepEqual(newlyFreedSlots(cells, cells), []);
  assert.deepEqual(newlyFreedSlots([{ ...cells[0], state: 'unavailable' }], cells), []);
});
test('only a previously observed occupancy becoming free creates an alert', () => {
  assert.deepEqual(newlyFreedSlots([{ ...cells[0], state: 'reserved' }, { ...cells[1], state: 'blocked' }], cells).map(c => c.id), ['0', '1']);
  assert.deepEqual(newlyFreedSlots(cells, cells.map(c => ({ ...c, state: 'reserved' }))), []);
});
