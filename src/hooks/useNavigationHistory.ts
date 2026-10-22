import { useLayoutEffect, useRef } from 'react';
import { useApp, type MainTab } from '../context/AppContext';

const tabs: MainTab[] = ['home', 'live', 'tournaments', 'scheduler', 'register_dupla', 'arenas_directory', 'saas_hub', 'ranking_athletes', 'shark_academy', 'my_bookings', 'arena_admin'];
export function readNavigation() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as MainTab;
  return { tab: tabs.includes(tab) ? tab : 'home' as MainTab, arena: params.get('arena') || '', tournament: params.get('tournament') || '' };
}

/** The app shell stays mounted; each history entry owns its scroll position. */
export function useNavigationHistory() {
  const { activeTab, setActiveTab, tenant, setTenantId, activeTournamentId, setActiveTournamentId } = useApp();
  const key = `${activeTab}:${tenant.id}:${activeTournamentId}`;
  const previous = useRef(key);
  const restoring = useRef(false);
  const restoreScroll = useRef<number | null>(null);
  const latest = useRef({ activeTab, tenant, setActiveTab, setTenantId, activeTournamentId, setActiveTournamentId });
  latest.current = { activeTab, tenant, setActiveTab, setTenantId, activeTournamentId, setActiveTournamentId };
  const scrollPosition = useRef(window.scrollY);
  useLayoutEffect(() => {
    const old = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saveScroll = () => {
      scrollPosition.current = window.scrollY;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        history.replaceState({ ...history.state, sharkScroll: scrollPosition.current }, '', window.location.href);
      }, 200);
    };
    const pop = () => {
      const route = readNavigation();
      clearTimeout(timer); timer = undefined;
      restoring.current = true;
      restoreScroll.current = Number(history.state?.sharkScroll) || 0;
      const current = latest.current;
      current.setActiveTab(route.tab);
      if (route.arena) current.setTenantId(route.arena);
      current.setActiveTournamentId(route.tournament);
      if (route.tab === current.activeTab && (!route.arena || route.arena === current.tenant.id) && route.tournament === current.activeTournamentId) {
        restoring.current = false; window.scrollTo(0, restoreScroll.current);
      }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('scroll', saveScroll, { passive: true });
    // Lazy content can arrive after history restoration. Restore once its geometry exists.
    const observer = new ResizeObserver(() => {
      const target = restoreScroll.current;
      if (target !== null && document.documentElement.scrollHeight >= target + innerHeight) {
        window.scrollTo(0, target); restoreScroll.current = null;
      }
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect(); history.scrollRestoration = old;
      clearTimeout(timer);
      window.removeEventListener('popstate', pop); window.removeEventListener('scroll', saveScroll);
    };
  }, []);
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    if (tenant.id) url.searchParams.set('arena', tenant.id); else url.searchParams.delete('arena');
    if (activeTournamentId) url.searchParams.set('tournament', activeTournamentId); else url.searchParams.delete('tournament');
    if (restoring.current) {
      restoring.current = false;
      window.scrollTo(0, restoreScroll.current || 0);
    } else if (previous.current !== key) {
      restoreScroll.current = null;
      history.replaceState({ ...history.state, sharkScroll: scrollPosition.current }, '', window.location.href);
      history.pushState({ sharkScroll: 0 }, '', url); window.scrollTo(0, 0);
      scrollPosition.current = 0;
    } else {
      history.replaceState({ ...history.state, sharkScroll: window.scrollY }, '', url);
    }
    previous.current = key;
  }, [key]);
}
