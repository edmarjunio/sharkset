import type { TenantConfig } from '../types';

const RECENT_SEARCHES_STORAGE_KEY = 'sharkset_recent_searches_v1';
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

const DEFAULT_RECENT_SEARCHES: string[] = [
  'Quadra de Futevôlei Hoje',
  'Série A / Open',
  'Aulas de Futevôlei',
  'Transmissão Ao Vivo',
];

const FALLBACK_POPULAR_ARENAS: PopularArenaSuggestion[] = [
  {
    id: 'popular-sharkset-matriz',
    name: 'SHARK SET Arena Matriz',
    city: 'Mineiros',
    state: 'GO',
    courtsCount: 4,
    rating: 4.9,
    badge: 'Em Alta 🔥',
    isCatalogArena: false,
  },
  {
    id: 'popular-orla-beach',
    name: 'Arena Orla Beach Club',
    city: 'Goiânia',
    state: 'GO',
    courtsCount: 6,
    rating: 4.8,
    badge: 'Mais Buscada ⭐',
    isCatalogArena: false,
  },
  {
    id: 'popular-sunset-sand',
    name: 'Sunset Sand Futevôlei & BT',
    city: 'Uberlândia',
    state: 'MG',
    courtsCount: 5,
    rating: 4.9,
    badge: 'Torneios Ativos 🏆',
    isCatalogArena: false,
  },
];

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return DEFAULT_RECENT_SEARCHES;
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_SEARCHES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_RECENT_SEARCHES;
    const valid = parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
    return valid.length > 0 ? valid : DEFAULT_RECENT_SEARCHES;
  } catch {
    return DEFAULT_RECENT_SEARCHES;
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
      // Ignore storage quota errors
    }
  }
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const current = getRecentSearches();
  const next = current.filter((item) => item.toLowerCase() !== term.toLowerCase());
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function clearRecentSearches(): string[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // Ignore storage errors
    }
  }
  return [];
}

export function getPopularArenaSuggestions(
  availableTenants: TenantConfig[],
  activeTenant?: TenantConfig
): PopularArenaSuggestion[] {
  if (availableTenants && availableTenants.length > 0) {
    return [...availableTenants]
      .sort((a, b) => (b.rating || 4.8) - (a.rating || 4.8) || (a.distanceKm || 0) - (b.distanceKm || 0))
      .slice(0, 5)
      .map((arena, index) => ({
        id: arena.id,
        name: arena.name,
        city: arena.city,
        state: arena.state,
        courtsCount: arena.courts?.length || 1,
        rating: arena.rating || 4.9,
        badge: index === 0 ? 'Mais Popular 🔥' : index === 1 ? 'Destaque ⭐' : `${arena.courts?.length || 1} quadras`,
        isCatalogArena: true,
      }));
  }

  if (activeTenant?.id && activeTenant?.name) {
    return [
      {
        id: activeTenant.id,
        name: activeTenant.name,
        city: activeTenant.city || 'Mineiros',
        state: activeTenant.state || 'GO',
        courtsCount: activeTenant.courts?.length || 2,
        rating: activeTenant.rating || 4.9,
        badge: 'Arena Atual ⭐',
        isCatalogArena: false,
      },
      ...FALLBACK_POPULAR_ARENAS.slice(0, 2),
    ];
  }

  return FALLBACK_POPULAR_ARENAS;
}
