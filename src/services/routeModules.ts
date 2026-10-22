import type { MainTab } from '../context/AppContext';

export const routeModules = {
  arena_admin: () => import('../components/ArenaAdmin').then(m => ({ default: m.ArenaAdmin })),
  scheduler: () => import('../components/CourtScheduler').then(m => ({ default: m.CourtScheduler })),
  tournaments: () => import('../components/DoubleEliminationBracket').then(m => ({ default: m.DoubleEliminationBracket })),
  register_dupla: () => import('../components/DoublesRegistration').then(m => ({ default: m.DoublesRegistration })),
  ranking_athletes: () => import('../components/RankingBoard').then(m => ({ default: m.RankingBoard })),
  my_bookings: () => import('../components/MyBookings').then(m => ({ default: m.MyBookings })),
  saas_hub: () => import('../components/SaaSConversionHub').then(m => ({ default: m.SaaSConversionHub })),
  shark_academy: () => import('../components/SharkAcademyCommunity').then(m => ({ default: m.SharkAcademyCommunity })),
  arenas_directory: () => import('../components/ArenasDirectory').then(m => ({ default: m.ArenasDirectory })),
};
const pending = new Set<string>();
export function prefetchRoute(tab: MainTab) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || pending.has(tab)) return;
  const load = routeModules[tab as keyof typeof routeModules];
  if (!load) return;
  pending.add(tab);
  void load().catch(() => pending.delete(tab));
}
