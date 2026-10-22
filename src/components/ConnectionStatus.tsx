import { useEffect, useState, useSyncExternalStore } from 'react';
import { arenaCatalog, tournamentCatalog } from '../services/catalogResources';
export function ConnectionStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const arenas = useSyncExternalStore(arenaCatalog.subscribe, arenaCatalog.getSnapshot);
  const tournaments = useSyncExternalStore(tournamentCatalog.subscribe, tournamentCatalog.getSnapshot);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const message = offline ? 'Sem conexão. Informações salvas podem estar desatualizadas. Reservas e pagamentos exigem conexão.' : arenas.error || tournaments.error ? 'Não foi possível atualizar o catálogo. As informações exibidas podem estar desatualizadas.' : '';
  return message ? <div role="status" className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[2001] rounded-xl bg-slate-950 px-4 py-2 text-sm text-amber-200 border border-amber-300/40">{message}</div> : null;
}
