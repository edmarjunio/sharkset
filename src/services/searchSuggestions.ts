import type { TenantConfig } from '../types';

const RECENT_SEARCHES_STORAGE_KEY = 'sharkset_recent_searches_v2';
const MAX_RECENT_SEARCHES = 6;

export interface PopularArenaSuggestion {
  id: string;
  name: string;
  city: string;
  state: string;
  courtsCount: number;
  rating: number;
  badge: string;
  isCatalogArena: boolean;
}

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  const cleaned = term.trim();
  if (!cleaned) return getRecentSearches();
  const current = getRecentSearches();
  const next = [
    cleaned,
    ...current.filter((item) => item.toLowerCase() !== cleaned.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors.
    }
  }
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const next = getRecentSearches().filter((item) => item.toLowerCase() !== term.toLowerCase());
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  }
  return next;
}

export function clearRecentSearches(): string[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // Ignore storage errors.
    }
  }
  return [];
}

function toArenaSuggestion(arena: TenantConfig, isCatalogArena: boolean): PopularArenaSuggestion {
  const courtsCount = arena.courts.length;
  const rating = arena.rating || 0;
  return {
    id: arena.id,
    name: arena.name,
    city: arena.city,
    state: arena.state,
    courtsCount,
    rating,
    badge: rating ? `${rating.toFixed(1)} · ${courtsCount} quadras` : `${courtsCount} quadras`,
    isCatalogArena,
  };
}

export function getPopularArenaSuggestions(
  availableTenants: TenantConfig[],
  activeTenant?: TenantConfig
): PopularArenaSuggestion[] {
  if (availableTenants.length > 0) {
    return [...availableTenants]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.distanceKm || 0) - (b.distanceKm || 0))
      .slice(0, 5)
      .map((arena) => toArenaSuggestion(arena, true));
  }

  if (!activeTenant?.id || !activeTenant.name) return [];
  return [toArenaSuggestion(activeTenant, false)];
}
