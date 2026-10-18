import React, { useEffect, useState } from 'react';
import { SharksetLogo } from './SharksetLogo';

export interface ScoreboardState {
  score1: number;
  score2: number;
  sets1?: number;
  sets2?: number;
  bestOf?: 1 | 3 | 5;
  elapsedSeconds?: number;
  clockStartedAt?: number | null;
}

export function elapsedTime(state: ScoreboardState, now = Date.now()) {
  return Math.max(0, state.elapsedSeconds || 0) + (state.clockStartedAt ? Math.max(0, Math.floor((now - state.clockStartedAt) / 1000)) : 0);
}

export function BroadcastOverlay({ state, team1 = 'Dupla 1', team2 = 'Dupla 2', onChange, onPoint } : {
  state: ScoreboardState; team1?: string; team2?: string;
  onChange?: (patch: Partial<ScoreboardState>) => void;
  onPoint?: (team: 1 | 2, delta: 1 | -1) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!state.clockStartedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [state.clockStartedAt]);
  const seconds = elapsedTime(state, now);
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <section aria-label="Placar da transmissão" className="rounded-2xl bg-[#071D3D]/95 text-white border border-[#12C7BB]/60 p-3 shadow-xl space-y-3">
    <header className="flex items-center justify-between gap-3">
      <SharksetLogo size="sm" showText />
      <span className="text-xs text-cyan-100">Melhor de {state.bestOf || 1}</span>
      <time className="font-mono text-xl tabular-nums">{duration}</time>
    </header>
    {([1, 2] as const).map(team => {
      const scoreKey = team === 1 ? 'score1' : 'score2';
      const setsKey = team === 1 ? 'sets1' : 'sets2';
      const name = team === 1 ? team1 : team2;
      return <div key={team} className="flex items-center gap-2 rounded-xl bg-white/10 p-2">
        <span className="text-sm font-bold flex-1 min-w-0 truncate" title={name}>{name}</span>
        {onChange && <button aria-label={`Tirar ponto de ${name}`} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-xl" onClick={() => onPoint ? onPoint(team, -1) : onChange({ [scoreKey]: Math.max(0, state[scoreKey] - 1) })}>−</button>}
        <strong className="text-3xl tabular-nums min-w-10 text-center">{state[scoreKey]}</strong>
        {onChange && <button aria-label={`Ponto para ${name}`} className="min-h-11 min-w-11 rounded-lg bg-[#0987CE] text-xl" onClick={() => onPoint ? onPoint(team, 1) : onChange({ [scoreKey]: state[scoreKey] + 1 })}>+</button>}
        <span className="text-xs text-cyan-100">Sets <strong>{state[setsKey] || 0}</strong></span>
      </div>;
    })}
    {onChange && <div className="flex flex-wrap gap-2 items-center text-xs">
      <button className="rounded-lg bg-[#12C7BB] text-[#071D3D] px-3 min-h-11 font-bold" onClick={() => {
        const currentTime = Date.now();
        setNow(currentTime);
        onChange(state.clockStartedAt ? { elapsedSeconds: elapsedTime(state, currentTime), clockStartedAt: null } : { clockStartedAt: currentTime });
      }}>{state.clockStartedAt ? 'Pausar tempo' : 'Iniciar tempo'}</button>
      <button className="rounded-lg bg-white/10 px-3 min-h-11" onClick={() => onChange({ elapsedSeconds: 0, clockStartedAt: null })}>Zerar tempo</button>
      <label className="flex items-center gap-1">Sets da partida <select aria-label="Número máximo de sets" className="bg-[#071D3D] rounded-lg p-2 min-h-11" value={state.bestOf || 1} onChange={event => onChange({ bestOf: Number(event.target.value) as 1 | 3 | 5, sets1: 0, sets2: 0 })}>
        {[1, 3, 5].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      {([1, 2] as const).map(team => <label key={team} className="flex items-center gap-1">Sets D{team}<input aria-label={`Sets da dupla ${team}`} type="number" min={0} max={Math.ceil((state.bestOf || 1) / 2)} className="w-14 bg-[#071D3D] p-2 rounded-lg min-h-11" value={(team === 1 ? state.sets1 : state.sets2) || 0} onChange={event => {
        const value = Number(event.target.value);
        if (Number.isInteger(value) && value >= 0 && value <= Math.ceil((state.bestOf || 1) / 2)) onChange({ [team === 1 ? 'sets1' : 'sets2']: value });
      }} /></label>)}
    </div>}
  </section>;
}
