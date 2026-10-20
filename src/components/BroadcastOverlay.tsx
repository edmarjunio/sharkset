import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SharksetLogo } from './SharksetLogo';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle,
  Undo2,
  Trophy,
  Clock,
  Layers,
} from 'lucide-react';
import { validateSet } from '../services/tournamentRules';

export interface ScoreboardState {
  score1: number;
  score2: number;
  sets1?: number;
  sets2?: number;
  bestOf?: 1 | 3 | 5;
  elapsedSeconds?: number;
  clockStartedAt?: number | null;
  stageName?: string;
  setHistory?: Array<[number, number]>;
  targetPoints?: number;
  decidingPoints?: number;
  winBy?: number;
}

export function elapsedTime(state: ScoreboardState, now = Date.now()): number {
  return (
    Math.max(0, state.elapsedSeconds || 0) +
    (state.clockStartedAt ? Math.max(0, Math.floor((now - state.clockStartedAt) / 1000)) : 0)
  );
}

export function isSemiOrFinalStage(stage?: string): boolean {
  if (!stage) return false;
  const normalized = stage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    normalized.includes('semifinal') ||
    normalized.includes('semi-final') ||
    normalized.includes('semi final') ||
    normalized.includes('final') ||
    normalized.includes('decisao') ||
    normalized.includes('disputa de 1') ||
    normalized.includes('disputa 1')
  );
}

export interface BroadcastOverlayProps {
  state: ScoreboardState;
  team1?: string;
  team2?: string;
  team1Category?: string;
  team2Category?: string;
  team1Avatar?: string;
  team2Avatar?: string;
  stageName?: string;
  compact?: boolean;
  onChange?: (patch: Partial<ScoreboardState>) => void;
  onPoint?: (team: 1 | 2, delta: 1 | -1) => void;
}

export function BroadcastOverlay({
  state,
  team1 = 'Dupla 1',
  team2 = 'Dupla 2',
  team1Category,
  team2Category,
  team1Avatar,
  team2Avatar,
  stageName,
  compact = false,
  onChange,
  onPoint,
}: BroadcastOverlayProps) {
  const [now, setNow] = useState(Date.now());
  const [pointHistory, setPointHistory] = useState<ScoreboardState[]>([]);

  // Auto-detect Semifinal / Final to set bestOf = 3 (MD3) if not explicitly set
  const detectedStage = stageName || state.stageName;
  const isDecisiveStage = useMemo(() => isSemiOrFinalStage(detectedStage), [detectedStage]);

  useEffect(() => {
    if (isDecisiveStage && onChange && state.bestOf !== 3) onChange({ bestOf: 3 });
  }, [isDecisiveStage, state.bestOf, onChange]);

  useEffect(() => {
    if (!state.clockStartedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [state.clockStartedAt]);

  const seconds = elapsedTime(state, now);
  const duration = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const bestOf = isDecisiveStage ? 3 : (state.bestOf || 1);
  const setsToWin = Math.ceil(bestOf / 2);
  const sets1 = state.sets1 || 0;
  const sets2 = state.sets2 || 0;
  const history = state.setHistory || [];
  const hasStartedMatch = state.score1 > 0 || state.score2 > 0 || sets1 > 0 || sets2 > 0;

  // Match winner detection
  const matchWinner = sets1 >= setsToWin ? 1 : sets2 >= setsToWin ? 2 : null;
  const isFinalSet = bestOf > 1 && sets1 + sets2 === bestOf - 1;
  const targetPoints = isFinalSet
    ? (state.decidingPoints || 15)
    : (state.targetPoints || 18);
  const winBy = state.winBy || 2;
  let validSetWinner: 1 | 2 | null = null;
  let closeSetError = '';
  try {
    validSetWinner = validateSet({ score1: state.score1, score2: state.score2 }, targetPoints, winBy);
  } catch (error) {
    closeSetError = error instanceof Error ? error.message : 'Placar ainda não encerra o set.';
  }

  const currentSnapshot = useCallback((): ScoreboardState => ({
    score1: state.score1,
    score2: state.score2,
    sets1,
    sets2,
    bestOf,
    elapsedSeconds: state.elapsedSeconds,
    clockStartedAt: state.clockStartedAt,
    stageName: detectedStage,
    setHistory: [...history],
    targetPoints: state.targetPoints,
    decidingPoints: state.decidingPoints,
    winBy: state.winBy,
  }), [state, sets1, sets2, bestOf, detectedStage, history]);

  // Add Point with history tracking for Undo
  const handlePointChange = useCallback(
    (team: 1 | 2, delta: 1 | -1) => {
      if (matchWinner) return;
      setPointHistory((prev) => [...prev.slice(-19), currentSnapshot()]);

      if (onPoint) {
        onPoint(team, delta);
      } else if (onChange) {
        const scoreKey = team === 1 ? 'score1' : 'score2';
        const current = state[scoreKey] || 0;
        onChange({ [scoreKey]: Math.max(0, current + delta) });
      }
    },
    [onPoint, onChange, state, matchWinner, currentSnapshot]
  );

  // Undo last point
  const handleUndo = useCallback(() => {
    if (!pointHistory.length || !onChange) return;
    const last = pointHistory[pointHistory.length - 1];
    setPointHistory((prev) => prev.slice(0, -1));
    onChange(last);
  }, [pointHistory, onChange]);

  // Finish current set: increment winner's set count, archive partial score, reset current set to 0 : 0
  const handleCloseSet = useCallback(() => {
    if (!onChange || matchWinner || !validSetWinner) return;
    const current1 = state.score1 || 0;
    const current2 = state.score2 || 0;

    setPointHistory((prev) => [...prev.slice(-19), currentSnapshot()]);
    const winner = validSetWinner;
    const nextSets1 = winner === 1 ? sets1 + 1 : sets1;
    const nextSets2 = winner === 2 ? sets2 + 1 : sets2;
    const isMatchComplete = nextSets1 >= setsToWin || nextSets2 >= setsToWin;
    const nextHistory: Array<[number, number]> = [...history, [current1, current2]];

    onChange({
      sets1: nextSets1,
      sets2: nextSets2,
      score1: isMatchComplete ? current1 : 0,
      score2: isMatchComplete ? current2 : 0,
      setHistory: nextHistory,
    });
  }, [onChange, matchWinner, validSetWinner, state.score1, state.score2, sets1, sets2, setsToWin, history, currentSnapshot]);

  // Toggle timer
  const handleToggleTimer = useCallback(() => {
    if (!onChange) return;
    const currentTime = Date.now();
    setNow(currentTime);
    if (state.clockStartedAt) {
      onChange({
        elapsedSeconds: elapsedTime(state, currentTime),
        clockStartedAt: null,
      });
    } else {
      onChange({ clockStartedAt: currentTime });
    }
  }, [onChange, state]);

  // Reset timer
  const handleResetTimer = useCallback(() => {
    if (!onChange) return;
    onChange({ elapsedSeconds: 0, clockStartedAt: null });
  }, [onChange]);

  // Keyboard shortcuts for operator / arena notebook
  useEffect(() => {
    if (!onChange) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePointChange(1, 1);
      } else if (key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        handlePointChange(2, 1);
      } else if (key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleToggleTimer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChange, handlePointChange, handleUndo, handleToggleTimer]);

  const displayStage = detectedStage || (isDecisiveStage ? 'Fase Decisiva' : 'Jogo Livre');

  return (
    <div className="w-full flex flex-col items-center select-none pointer-events-auto">
      {/* =========================================================
          1. PLACAR PRINCIPAL DE BROADCAST (TOPO CENTRAL - ESTILO TV)
          ========================================================= */}
      <section
        aria-label="Placar oficial da transmissão SHARKSET"
        className="relative w-full max-w-3xl mx-auto filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] transition-all animate-in fade-in slide-in-from-top-2 duration-300"
      >
        {/* TOPO/CENTRO: BRANDING SHARKSET + CRONÔMETRO + FASE DO JOGO */}
        <div className="flex justify-center -mb-1 relative z-20">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-t-xl bg-gradient-to-b from-[#0B254E] via-[#071D3D] to-[#041226] border-t border-x border-[#12C7BB]/60 shadow-lg text-white">
            <SharksetLogo size="xs" showText />
            <div className="h-3.5 w-px bg-white/20" />
            <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-[#12C7BB] tracking-wider tabular-nums">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{duration}</span>
            </div>
            <div className="h-3.5 w-px bg-white/20" />
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300">
              <Trophy className="w-3 h-3 text-orange-400" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{displayStage}</span>
            </div>
            {bestOf > 1 && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#0987CE]/40 text-cyan-200 border border-[#0987CE]/60">
                MD{bestOf}
              </span>
            )}
          </div>
        </div>

        {/* ESTRUTURA HORIZONTAL COM ABAS ANGULARES */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#071D3D]/95 via-[#030E1F]/98 to-[#020814]/98 text-white border-2 border-[#12C7BB]/70 shadow-[0_8px_32px_rgba(2,11,24,0.85)] overflow-hidden backdrop-blur-md">
          {/* Luz sutil de destaque no topo */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#12C7BB] to-transparent opacity-80" />

          <div className="grid grid-cols-12 items-stretch min-h-[64px] sm:min-h-[72px]">
            {/* ASA LATERAL ESQUERDA: DUPLA A */}
            <div className="col-span-5 flex items-center justify-end gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-gradient-to-r from-white/[0.04] to-transparent border-r border-white/10 relative">
              {/* Indicador de Sets Vencidos Dupla A (estilo bolinhas esportivas de TV) */}
              {bestOf > 1 && (
                <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                  {Array.from({ length: setsToWin }).map((_, i) => (
                    <span
                      key={i}
                      title={`Set ${i + 1} Dupla A`}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all border ${
                        i < sets1
                          ? 'bg-[#12C7BB] border-white shadow-[0_0_8px_#12C7BB]'
                          : 'bg-white/10 border-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Informações da Dupla A */}
              <div className="text-right min-w-0 flex-1">
                <div className="flex items-center justify-end gap-1.5">
                  <span
                    className="text-xs sm:text-base font-black tracking-tight text-white truncate block drop-shadow-sm"
                    title={team1}
                  >
                    {team1}
                  </span>
                </div>
                {team1Category && (
                  <span className="text-[10px] text-cyan-200/90 font-bold block truncate">
                    {team1Category}
                  </span>
                )}
              </div>

              {/* Avatar da Dupla A */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#0987CE] to-[#071D3D] border border-cyan-400/50 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner overflow-hidden">
                {team1Avatar ? (
                  <img src={team1Avatar} alt={team1} className="w-full h-full object-cover" />
                ) : (
                  <span>A</span>
                )}
              </div>
            </div>

            {/* BLOCO CENTRAL PRINCIPAL: PONTUAÇÃO DO SET ATUAL (ALTO CONTRASTE) */}
            <div className="col-span-2 flex flex-col items-center justify-center px-1 py-1.5 bg-gradient-to-b from-[#0F2D59] to-[#041226] border-x-2 border-[#12C7BB]/60 relative shadow-inner">
              {/* Indicador de Set Atual */}
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-cyan-200/80 -mt-0.5 mb-0.5">
                {matchWinner ? 'FINAL' : bestOf > 1 ? `SET ${sets1 + sets2 + 1}` : 'PONTOS'}
              </div>

              {/* Dígitos da Pontuação em Destaque */}
              <div className="flex items-center justify-center gap-1 sm:gap-2 w-full font-mono font-black text-2xl sm:text-4xl tabular-nums leading-none">
                <span className="text-[#FFB347] drop-shadow-[0_2px_8px_rgba(255,179,71,0.5)]">
                  {state.score1}
                </span>
                <span className="text-white/40 text-lg sm:text-2xl font-light pb-0.5">:</span>
                <span className="text-[#5BC3FA] drop-shadow-[0_2px_8px_rgba(91,195,250,0.5)]">
                  {state.score2}
                </span>
              </div>

              {/* Sets vencidos resumo rápido */}
              {bestOf > 1 && (
                <div className="text-[9px] font-black tracking-wider text-slate-300 mt-1 flex items-center gap-1">
                  <span className="text-cyan-200 font-bold">{sets1}</span>
                  <span className="text-white/40">s</span>
                  <span className="text-cyan-200 font-bold">{sets2}</span>
                </div>
              )}
            </div>

            {/* ASA LATERAL DIREITA: DUPLA B */}
            <div className="col-span-5 flex items-center justify-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-gradient-to-l from-white/[0.04] to-transparent border-l border-white/10 relative">
              {/* Avatar da Dupla B */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#12C7BB] to-[#071D3D] border border-emerald-400/50 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner overflow-hidden">
                {team2Avatar ? (
                  <img src={team2Avatar} alt={team2} className="w-full h-full object-cover" />
                ) : (
                  <span>B</span>
                )}
              </div>

              {/* Informações da Dupla B */}
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center justify-start gap-1.5">
                  <span
                    className="text-xs sm:text-base font-black tracking-tight text-white truncate block drop-shadow-sm"
                    title={team2}
                  >
                    {team2}
                  </span>
                </div>
                {team2Category && (
                  <span className="text-[10px] text-cyan-200/90 font-bold block truncate">
                    {team2Category}
                  </span>
                )}
              </div>

              {/* Indicador de Sets Vencidos Dupla B */}
              {bestOf > 1 && (
                <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                  {Array.from({ length: setsToWin }).map((_, i) => (
                    <span
                      key={i}
                      title={`Set ${i + 1} Dupla B`}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all border ${
                        i < sets2
                          ? 'bg-[#12C7BB] border-white shadow-[0_0_8px_#12C7BB]'
                          : 'bg-white/10 border-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HISTÓRICO DE PARCIAIS DOS SETS ANTERIORES (SE HOUVER) */}
          {(history.length > 0 || matchWinner) && (
            <div className="px-3 py-1.5 bg-black/60 border-t border-white/10 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
              <span className="text-[10px] font-black uppercase text-cyan-300 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#12C7BB]" />
                Parciais:
              </span>
              {history.map(([s1, s2], idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-white/10 font-mono font-bold text-white text-[10px] border border-white/10"
                >
                  Set {idx + 1}: <strong className="text-amber-300">{s1}</strong> -{' '}
                  <strong className="text-sky-300">{s2}</strong>
                </span>
              ))}
              {matchWinner && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <CheckCircle className="w-3 h-3" />
                  Vitória Dupla {matchWinner === 1 ? team1 : team2}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          2. BARRA DE COMANDO ULTRA-FÁCIL DO OPERADOR / TRANSMISSOR
          (APENAS QUANDO onChange ESTIVER PRESENTE)
          ========================================================= */}
      {onChange && !compact && (
        <section
          aria-label="Painel de controle do operador do placar"
          className="w-full max-w-3xl mt-3 p-3 sm:p-4 rounded-2xl bg-[#030E1F]/95 border-2 border-[#0987CE]/50 shadow-2xl space-y-3.5 backdrop-blur-md text-white"
        >
          {/* CABEÇALHO DO PAINEL DO OPERADOR */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-cyan-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Controle Rápido do Operador (1-Toque / Sem Fricção)
            </div>
            <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">A / ←</span> +1 D1
              <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">L / →</span> +1 D2
              <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Z</span> Desfazer
              <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Espaço</span> Tempo
            </div>
          </div>

          {/* BOTÕES GRANDES 3D DE PONTUAÇÃO (DUPLA A & DUPLA B) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* DUPLA A (+1 E -1) */}
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-gradient-to-b from-[#0987CE]/15 to-[#071D3D]/40 border border-[#0987CE]/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-amber-300 truncate" title={team1}>
                  {team1}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Lado A</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Tirar ponto de ${team1}`}
                  onClick={() => handlePointChange(1, -1)}
                  disabled={matchWinner !== null || state.score1 <= 0}
                  className="w-12 h-14 sm:h-16 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 text-slate-200 border border-white/15 flex items-center justify-center font-black text-xl transition-all shadow-md"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label={`Ponto para ${team1}`}
                  onClick={() => handlePointChange(1, 1)}
                  disabled={matchWinner !== null}
                  className="flex-1 h-14 sm:h-16 bg-gradient-to-b from-[#FF8C00] to-[#E65100] hover:from-[#FFA726] hover:to-[#EF6C00] disabled:opacity-35 disabled:cursor-not-allowed active:scale-98 rounded-xl text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_16px_rgba(230,81,0,0.5)] border-t border-amber-300/60"
                >
                  <Plus className="w-6 h-6" />
                  <span>+1 PONTO</span>
                </button>
              </div>
            </div>

            {/* DUPLA B (+1 E -1) */}
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-gradient-to-b from-[#12C7BB]/15 to-[#071D3D]/40 border border-[#12C7BB]/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-cyan-300 truncate" title={team2}>
                  {team2}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Lado B</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Ponto para ${team2}`}
                  onClick={() => handlePointChange(2, 1)}
                  disabled={matchWinner !== null}
                  className="flex-1 h-14 sm:h-16 rounded-xl bg-gradient-to-b from-[#0987CE] to-[#044E7A] hover:from-[#29B6F6] hover:to-[#0277BD] disabled:opacity-35 disabled:cursor-not-allowed active:scale-98 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_16px_rgba(9,135,206,0.5)] border-t border-cyan-300/60"
                >
                  <Plus className="w-6 h-6" />
                  <span>+1 PONTO</span>
                </button>
                <button
                  type="button"
                  aria-label={`Tirar ponto de ${team2}`}
                  onClick={() => handlePointChange(2, -1)}
                  disabled={matchWinner !== null || state.score2 <= 0}
                  className="w-12 h-14 sm:h-16 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 text-slate-200 border border-white/15 flex items-center justify-center font-black text-xl transition-all shadow-md"
                >
                  <Minus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* LINHA DE COMANDOS SECUNDÁRIOS: DESFAZER, FECHAR SET, CRONÔMETRO E SELETOR DE MD1/MD3 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {/* DESFAZER ÚLTIMO PONTO (UNDO) */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!pointHistory.length}
              className="min-h-11 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold flex items-center justify-center gap-1.5 border border-white/10 transition-all shadow-sm"
            >
              <Undo2 className="w-4 h-4 text-amber-400" />
              <span>Desfazer Ponto</span>
            </button>

            {/* FECHAR SET ATUAL (TRANSIÇÃO INTELIGENTE DE SET) */}
            <button
              type="button"
              onClick={handleCloseSet}
              disabled={matchWinner !== null || !validSetWinner}
              title={matchWinner ? 'A partida já foi decidida.' : closeSetError}
              className="min-h-11 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black text-white flex items-center justify-center gap-1.5 transition-all shadow-md border-t border-emerald-300/40"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Fechar Set Atual</span>
            </button>

            {/* PLAY / PAUSE CRONÔMETRO */}
            <button
              type="button"
              onClick={handleToggleTimer}
              className={`min-h-11 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                state.clockStartedAt
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-[#12C7BB] hover:bg-[#0ea89e] text-[#071D3D]'
              }`}
            >
              {state.clockStartedAt ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pausar Tempo</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Tempo</span>
                </>
              )}
            </button>

            {/* ZERAR CRONÔMETRO */}
            <button
              type="button"
              onClick={handleResetTimer}
              className="min-h-11 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Tempo</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400" role="status">
            {matchWinner
              ? `Partida encerrada: ${matchWinner === 1 ? team1 : team2} venceu.`
              : `Para fechar o set: ${targetPoints} pontos com ${winBy} de vantagem. ${closeSetError}`}
          </p>

          {/* CONTROLE DETALHADO DE FORMATO (1 SET VS MELHOR DE 3) E AJUSTE MANUAL DE SETS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
            {/* SELETOR RÁPIDO DE FORMATO */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Formato:</span>
              <div className="inline-flex rounded-xl bg-black/40 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => onChange({ bestOf: 1, sets1: 0, sets2: 0, setHistory: [], score1: 0, score2: 0 })}
                  disabled={isDecisiveStage || matchWinner !== null || hasStartedMatch}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    bestOf === 1
                      ? 'bg-[#0987CE] text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 Set
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ bestOf: 3, sets1: 0, sets2: 0, setHistory: [], score1: 0, score2: 0 })}
                  disabled={matchWinner !== null || hasStartedMatch}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    bestOf === 3
                      ? 'bg-[#12C7BB] text-[#071D3D] shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Melhor de 3 (MD3)
                </button>
              </div>
            </div>

            {/* AJUSTE MANUAL DE SETS */}
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold">Sets Manual:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-[11px] font-bold">D1:</span>
                <button
                  type="button"
                  aria-label="Diminuir sets dupla 1"
                  onClick={() => onChange({ sets1: Math.max(0, sets1 - 1) })}
                  disabled={sets1 === 0}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-black"
                >
                  -
                </button>
                <span className="font-mono font-black text-amber-300 w-4 text-center">{sets1}</span>
                <button
                  type="button"
                  aria-label="Aumentar sets dupla 1"
                  onClick={() => onChange({ sets1: Math.min(setsToWin, sets1 + 1) })}
                  disabled={sets1 >= setsToWin || matchWinner !== null}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-black"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-[11px] font-bold">D2:</span>
                <button
                  type="button"
                  aria-label="Diminuir sets dupla 2"
                  onClick={() => onChange({ sets2: Math.max(0, sets2 - 1) })}
                  disabled={sets2 === 0}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-black"
                >
                  -
                </button>
                <span className="font-mono font-black text-sky-300 w-4 text-center">{sets2}</span>
                <button
                  type="button"
                  aria-label="Aumentar sets dupla 2"
                  onClick={() => onChange({ sets2: Math.min(setsToWin, sets2 + 1) })}
                  disabled={sets2 >= setsToWin || matchWinner !== null}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-black"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
