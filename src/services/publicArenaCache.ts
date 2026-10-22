import type { TenantConfig } from '../types';
const key = 'sharkset_public_arenas_v1';
const maxAge = 5 * 60_000;

/** Only presentation fields may be persisted. Permissions always come from the server. */
export function publicArenaProjection(arena: TenantConfig): TenantConfig {
  const fields = ['id', 'name', 'city', 'state', 'address', 'distanceKm', 'operatingHours', 'amenities', 'tagline', 'rating', 'whatsapp', 'primaryColor', 'accentColor', 'sandBg', 'imageUrl', 'logoUrl', 'whiteLabelEnabled', 'brandPalette', 'lat', 'lng'] as const;
  const projection = Object.fromEntries(fields.filter(field => arena[field] !== undefined).map(field => [field, arena[field]]));
  return { ...projection, courts: arena.courts.map(court => ({
    id: court.id, name: court.name, sports: court.sports, hourlyRate: court.hourlyRate,
    ...(court.openTime ? { openTime: court.openTime } : {}),
    ...(court.closeTime ? { closeTime: court.closeTime } : {}),
  })) } as TenantConfig;
}
export function readPublicArenas(storage?: Pick<Storage, 'getItem'>, now = Date.now()): Record<string, TenantConfig> | undefined {
  try {
    const saved = JSON.parse((storage || localStorage).getItem(key) || 'null');
    if (!saved || saved.version !== 1 || !Number.isFinite(saved.at) || saved.at > now || now - saved.at > maxAge || !Array.isArray(saved.arenas)) return;
    const arenas = saved.arenas.map(publicArenaProjection);
    return Object.fromEntries(arenas.map((arena: TenantConfig) => [arena.id, arena]));
  } catch { return; }
}
export function writePublicArenas(arenas: TenantConfig[], storage?: Pick<Storage, 'setItem'>, now = Date.now()) {
  try { (storage || localStorage).setItem(key, JSON.stringify({ version: 1, at: now, arenas: arenas.map(publicArenaProjection) })); } catch { /* Storage quota/private mode is non-fatal. */ }
}
