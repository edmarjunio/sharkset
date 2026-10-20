import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ExternalLink, Trophy, X } from 'lucide-react';
import { listenToTournamentResultEvents, type TournamentResultEvent } from '../lib/firebase';

type TournamentResultNotificationsProps = {
  tournamentIds: string[];
  onOpenMatch: (event: TournamentResultEvent) => void;
};

export function TournamentResultNotifications({ tournamentIds, onOpenMatch }: TournamentResultNotificationsProps) {
  const [historyById, setHistoryById] = useState<Record<string, TournamentResultEvent>>({});
  const [queue, setQueue] = useState<TournamentResultEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const initialized = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const visibleEvent = queue[0];

  const idKey = [...new Set(tournamentIds.filter(Boolean))].slice(0, 2).join('|');
  const normalizedIds = useMemo(() => idKey ? idKey.split('|') : [], [idKey]);

  useEffect(() => {
    initialized.current = new Set();
    const unsubscribes = normalizedIds.map((tournamentId) =>
      listenToTournamentResultEvents(
        tournamentId,
        (events, changes) => {
          setHistoryById((previous) => {
            const next = { ...previous };
            for (const event of events) next[event.eventId] = event;
            return next;
          });

          if (!initialized.current.has(tournamentId)) {
            initialized.current.add(tournamentId);
            for (const event of events) seen.current.add(event.eventId);
            return;
          }

          const newEvents = changes
            .filter((change) => change.type === 'added' && !seen.current.has(change.id))
            .map((change) => events.find((event) => event.eventId === change.id))
            .filter((event): event is TournamentResultEvent => Boolean(event))
            .sort((left, right) => Date.parse(left.officialAt) - Date.parse(right.officialAt));

          if (newEvents.length) {
            for (const event of newEvents) seen.current.add(event.eventId);
            setQueue((previous) => [...previous, ...newEvents]);
          }
        },
        (error) => console.error('Falha ao receber resultados ao vivo do campeonato.', error)
      )
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [normalizedIds]);

  useEffect(() => {
    if (!visibleEvent) return;
    const timeout = window.setTimeout(() => setQueue((previous) => previous.slice(1)), 8000);
    return () => window.clearTimeout(timeout);
  }, [visibleEvent?.eventId]);

  const history = Object.values(historyById)
    .filter((event) => normalizedIds.includes(event.tournamentId))
    .sort((left, right) => Date.parse(right.officialAt) - Date.parse(left.officialAt))
    .slice(0, 20);

  if (normalizedIds.length === 0) return null;

  return (
    <div className="fixed top-[5.25rem] right-3 sm:right-5 z-[90] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col items-end gap-2 pointer-events-none">
      {visibleEvent && (
        <article
          key={visibleEvent.eventId}
          className="tournament-result-toast pointer-events-auto w-full overflow-hidden rounded-2xl border border-cyan-300/40 bg-[#041b30]/95 text-white shadow-2xl backdrop-blur-xl"
          aria-live="polite"
          aria-atomic="true"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-cyan-950/40 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="truncate text-[11px] font-black uppercase tracking-wide text-cyan-100">
                {visibleEvent.kind === 'result_corrected' ? 'Resultado corrigido oficialmente' : 'Resultado confirmado'}
              </span>
            </div>
            <button type="button" className="rounded-full p-1 text-slate-300 hover:bg-white/10" aria-label="Fechar notificação" onClick={() => setQueue((previous) => previous.slice(1))}>
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="space-y-3 p-4">
            <div>
              <p className="truncate text-sm font-extrabold">{visibleEvent.tournamentName}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-cyan-100/70">
                {visibleEvent.stageName}{visibleEvent.courtName ? ` · ${visibleEvent.courtName}` : ''} · Jogo {visibleEvent.matchNumber}
              </p>
            </div>

            {visibleEvent.resultMode === 'walkover' ? (
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
                W.O. oficial · Vencedores: {visibleEvent.winnerId === visibleEvent.team1.id ? visibleEvent.team1.name : visibleEvent.team2.name}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/40">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-white/5 px-3 py-2 text-xs">
                  <span className="truncate font-semibold">{visibleEvent.team1.name}</span>
                  <span className="text-right font-black tabular-nums text-cyan-100">{visibleEvent.sets.map((set) => set.score1).join(' / ')}</span>
                  {visibleEvent.winnerId === visibleEvent.team1.id && <Trophy className="h-3.5 w-3.5 text-amber-300" />}
                  {visibleEvent.winnerId !== visibleEvent.team1.id && <span />}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3 py-2 text-xs">
                  <span className="truncate font-semibold">{visibleEvent.team2.name}</span>
                  <span className="text-right font-black tabular-nums text-cyan-100">{visibleEvent.sets.map((set) => set.score2).join(' / ')}</span>
                  {visibleEvent.winnerId === visibleEvent.team2.id && <Trophy className="h-3.5 w-3.5 text-amber-300" />}
                  {visibleEvent.winnerId !== visibleEvent.team2.id && <span />}
                </div>
              </div>
            )}

            <button type="button" className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-300" onClick={() => onOpenMatch(visibleEvent)}>
              <ExternalLink className="h-3.5 w-3.5" /> Ver partida na tabela
            </button>
          </div>
        </article>
      )}

      {history.length > 0 && (
        <div className="pointer-events-auto w-full">
          <button type="button" className="ml-auto flex items-center gap-1.5 rounded-full border border-cyan-200/25 bg-[#041b30]/90 px-3 py-1.5 text-[11px] font-bold text-cyan-100 shadow-lg backdrop-blur" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
            <Bell className="h-3.5 w-3.5" /> Histórico de resultados <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-cyan-200">{history.length}</span>
          </button>
          {historyOpen && (
            <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-cyan-300/30 bg-[#041b30]/95 p-2 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-xs font-black text-cyan-100">Resultados deste campeonato</p>
                <button type="button" className="rounded-full p-1 text-slate-300 hover:bg-white/10" aria-label="Fechar histórico" onClick={() => setHistoryOpen(false)}><X className="h-4 w-4" /></button>
              </div>
              <ul className="space-y-1">
                {history.map((event) => (
                  <li key={event.eventId}>
                    <button type="button" className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-white/5" onClick={() => { setHistoryOpen(false); onOpenMatch(event); }}>
                      {event.kind === 'result_corrected' ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /> : <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold">Jogo {event.matchNumber} · {event.stageName}</span>
                        <span className="block truncate text-[10px] text-slate-300">{event.team1.name} {event.resultMode === 'walkover' ? '· W.O.' : event.sets.map((set) => `${set.score1}×${set.score2}`).join(' / ')} {event.team2.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
