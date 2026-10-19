import { matchPhaseLabel } from '../services/bracketPresentation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BracketMatch, BracketSource, MatchSet, SemiFormat, TeamPair } from '../types';
import { layoutBracket, bracketEdges, bracketSlotOrigins, CARD_WIDTH, CARD_HEIGHT } from '../services/bracketLayout';
import { matchRules } from '../services/tournamentRules';
import { computeTopFive } from '../services/podium';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Trophy,
  Radio,
  Check,
  Sliders,
  ShieldAlert,
  Sparkles,
  Compass,
  X,
} from 'lucide-react';

interface FutevoleiVisualBracketCanvasProps {
  matches: BracketMatch[];
  semiFormat: SemiFormat;
  isSingles: boolean;
  formatParticipantName: (pair?: TeamPair) => string;
  getInlineScore: (match: BracketMatch, side: 's1' | 's2') => string;
  onInlineScoreChange: (match: BracketMatch, side: 's1' | 's2', val: string) => void;
  onInlineSubmit: (match: BracketMatch, e?: React.FormEvent) => void;
  onOpenRefereeModal: (matchId: string) => void;
  onOpenMatchEditor: (match: BracketMatch) => void;
  onSelectMatchCard?: (match: BracketMatch) => void;
  onCallMatchCourt?: (match: BracketMatch) => void;
  onShareMatch?: (match: BracketMatch) => void;
  onHistoryMatch?: (match: BracketMatch) => void;
  onToggleLiveMatch?: (match: BracketMatch) => void;
  onQuickOfficialize?: (match: BracketMatch, sets: MatchSet[]) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  knockoutOnlyMode?: boolean;
  onToggleKnockoutOnlyMode?: () => void;
}

export const FutevoleiVisualBracketCanvas: React.FC<FutevoleiVisualBracketCanvasProps> = (props) => {
  const {
    matches,
    formatParticipantName,
    onOpenMatchEditor,
    onOpenRefereeModal,
    onToggleLiveMatch,
    onQuickOfficialize,
  } = props;

  const container = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<'panorama' | 'columns'>(() =>
    localStorage.getItem('sharkset_bracket_view') === 'columns' ? 'columns' : 'panorama'
  );
  const [search, setSearch] = useState('');
  const [quickModalMatchId, setQuickModalMatchId] = useState<string | null>(null);
  const [quickSets, setQuickSets] = useState<MatchSet[]>([{ score1: 18, score2: 14 }]);
  const [quickError, setQuickError] = useState<string | null>(null);

  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  const viewport = useRef({ left: 0, top: 0 });

  const layout = useMemo(() => layoutBracket(matches), [matches]);
  const podium = useMemo(() => computeTopFive(matches), [matches]);
  const edges = useMemo(() => bracketEdges(matches), [matches]);
  const slotOrigins = useMemo(() => bracketSlotOrigins(matches), [matches]);
  const matchById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const identity = matches.map((match) => match.id).join('|');

  // Exact vertical Y centers inside the 220px card for Slot 1 (top line), Slot 2 (bottom line), and Fork Midpoint
  const SLOT1_Y = 66;
  const SLOT2_Y = 116;
  const MID_Y = (SLOT1_Y + SLOT2_Y) / 2; // 91

  const quickModalMatch = useMemo(
    () => (quickModalMatchId ? matchById.get(quickModalMatchId) || null : null),
    [quickModalMatchId, matchById]
  );

  function openQuickModal(match: BracketMatch) {
    const rules = matchRules(match);
    const neededWins = Math.ceil(rules.bestOf / 2);
    if (match.sets && match.sets.length > 0) {
      setQuickSets(match.sets.map((s) => ({ ...s })));
    } else {
      setQuickSets(
        Array.from({ length: neededWins }, (_, idx) => ({
          score1: idx === neededWins - 1 && rules.bestOf > 1 ? rules.targetPoints : rules.targetPoints,
          score2: Math.max(0, rules.targetPoints - 4),
        }))
      );
    }
    setQuickError(null);
    setQuickModalMatchId(match.id);
  }

  function fit() {
    if (!container.current) return;
    const fitScale = Math.max(
      0.01,
      Math.min(
        1,
        (container.current.clientWidth - 32) / layout.width,
        (container.current.clientHeight - 32) / layout.height
      )
    );
    setZoom(fitScale);
    container.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  function focusZone(zone: 'winners' | 'center' | 'losers') {
    const el = container.current;
    if (!el) return;
    const targetZoom = Math.max(zoom, 0.78);
    setZoom(targetZoom);
    requestAnimationFrame(() => {
      const scaledWidth = layout.width * targetZoom;
      const clientW = el.clientWidth;
      let targetLeft = 0;
      if (zone === 'winners') {
        targetLeft = 0;
      } else if (zone === 'center') {
        targetLeft = Math.max(0, layout.centerX * targetZoom - clientW / 2 + (CARD_WIDTH * targetZoom) / 2);
      } else {
        targetLeft = Math.max(0, scaledWidth - clientW);
      }
      el.scrollTo({ left: targetLeft, top: 0, behavior: 'smooth' });
    });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [identity, props.isFullscreen, view]);

  useEffect(() => {
    if (!props.isFullscreen) return;
    setView('panorama');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [props.isFullscreen]);

  useEffect(() => {
    container.current?.scrollTo(viewport.current.left, viewport.current.top);
  }, [view]);

  const matchingIds = useMemo(
    () =>
      new Set(
        matches
          .filter((match) =>
            `${match.team1?.player1 || ''} ${match.team1?.player2 || ''} ${match.team2?.player1 || ''} ${
              match.team2?.player2 || ''
            } ${match.matchNumber} ${match.stageName}`
              .toLowerCase()
              .includes(search.toLowerCase())
          )
          .map((match) => match.id)
      ),
    [matches, search]
  );

  function zoomAt(next: number, clientX?: number, clientY?: number) {
    const element = container.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const x = clientX === undefined ? element.clientWidth / 2 : clientX - bounds.left;
    const y = clientY === undefined ? element.clientHeight / 2 : clientY - bounds.top;
    const target = Math.max(0.01, Math.min(2.2, next));
    const beforeOffset = Math.max(0, (element.clientWidth - layout.width * zoom) / 2);
    const afterOffset = Math.max(0, (element.clientWidth - layout.width * target) / 2);
    const left = ((element.scrollLeft + x - beforeOffset) / zoom) * target - x + afterOffset;
    const top = ((element.scrollTop + y) / zoom) * target - y;
    setZoom(target);
    requestAnimationFrame(() => element.scrollTo(left, top));
  }

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(zoom * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoom, view, props.isFullscreen, layout.width]);

  function getSlotSourceInfo(
    match: BracketMatch,
    slotIndex: 0 | 1
  ): {
    code: string;
    originLabel: string;
    displayName: string;
    kind: 'team' | 'winner' | 'loser' | 'unknown';
  } {
    const pair = slotIndex === 0 ? match.team1 : match.team2;
    const rawSource =
      (slotIndex === 0 ? match.source1 : match.source2) ??
      slotOrigins.get(`${match.id}:${slotIndex}`);

    if (rawSource?.kind === 'team') {
      const seedNum = rawSource.team?.seed ?? pair?.seed ?? slotIndex + 1;
      return {
        code: `${seedNum}º`,
        originLabel: `Cabeça #${seedNum} · Entrada Principal`,
        displayName: pair ? formatParticipantName(pair) : formatParticipantName(rawSource.team),
        kind: 'team',
      };
    }

    if (rawSource && (rawSource.kind === 'winner' || rawSource.kind === 'loser')) {
      const originMatch = matchById.get(rawSource.matchId);
      const num = originMatch?.matchNumber;
      const isWin = rawSource.kind === 'winner';
      const code = num ? `${isWin ? 'V' : 'P'}${num}` : isWin ? 'V?' : 'P?';
      const originLabel = num
        ? `${isWin ? 'Vencedor' : 'Perdedor'} do Jogo ${num} (${code})`
        : 'Aguardando definição';
      return {
        code,
        originLabel,
        displayName: pair ? formatParticipantName(pair) : originLabel.toUpperCase(),
        kind: rawSource.kind,
      };
    }

    return {
      code: pair ? `#${pair.seed}` : '—',
      originLabel: pair ? `Dupla #${pair.seed}` : 'A definir',
      displayName: pair ? formatParticipantName(pair) : 'A definir',
      kind: pair ? 'team' : 'unknown',
    };
  }

  function getMatchDisplayTitle(match: BracketMatch): string {
    if (['semifinals', 'grand_final', 'super_final', 'third_place'].includes(match.stage)) return matchPhaseLabel(match);
    return (match.stage === 'winners' ? 'Principal' : 'Repescagem') + ' R' + match.round + ' · Jogo ' + match.matchNumber;
  }

  function isMatchLive(match: BracketMatch): boolean {
    return (
      match.status === 'in_progress' ||
      (match.status !== 'completed' &&
        Boolean(match.liveReferee) &&
        ((match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0))
    );
  }

  function card(match: BracketMatch) {
    const blocked = match.semifinalDecision === 'blocked';
    const isCompleted = match.status === 'completed';
    const isLive = isMatchLive(match);
    const isReady = Boolean(match.team1 && match.team2 && !blocked);
    const outgoing = edges.filter((edge) => edge.from === match.id);
    const winnerEdge = outgoing.find((e) => e.outcome === 'winner');
    const loserEdge = outgoing.find((e) => e.outcome === 'loser');
    const winnerDestMatch = winnerEdge ? matchById.get(winnerEdge.to) : undefined;
    const loserDestMatch = loserEdge ? matchById.get(loserEdge.to) : undefined;

    const isFinalMatch = match.stage === 'grand_final' || match.stage === 'super_final';
    const isThirdMatch = match.stage === 'third_place';
    const stageCardClass = isFinalMatch
      ? 'bracket-card-final'
      : isThirdMatch
      ? 'bracket-card-bronze'
      : match.stage === 'winners'
      ? 'bracket-card-winners'
      : match.stage === 'losers'
      ? 'bracket-card-losers'
      : 'bracket-card-central';

    const stageBadgeClass = isFinalMatch
      ? 'bg-yellow-200 text-amber-950'
      : isThirdMatch
      ? 'bg-orange-200 text-orange-950'
      : match.stage === 'winners'
      ? 'bg-emerald-400 text-slate-950'
      : match.stage === 'losers'
      ? 'bg-amber-400 text-slate-950'
      : 'bg-sky-400 text-slate-950';

    const slot1 = getSlotSourceInfo(match, 0);
    const slot2 = getSlotSourceInfo(match, 1);
    const team1Won = isCompleted && match.winnerId === match.team1?.id;
    const team2Won = isCompleted && match.winnerId === match.team2?.id;
    const displayTitle = getMatchDisplayTitle(match);

    return (
      <article
        key={match.id}
        data-match-id={match.id}
        className={`relative rounded-2xl px-2.5 py-2 h-full overflow-hidden transition-all ${stageCardClass} ${
          isLive ? 'bracket-card-live' : ''
        } ${search && matchingIds.has(match.id) ? 'ring-3 ring-cyan-300' : ''}`}
      >
        {/* Top Header: Match Number + Stage + Live/Status Badge (y: 8..34) */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] leading-tight h-[28px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`px-1.5 py-0.5 rounded-md font-black text-[10px] shrink-0 ${stageBadgeClass}`}>
              J#{match.matchNumber} · V{match.matchNumber}
            </span>
            <strong className="truncate text-white font-extrabold text-[11px]" title={displayTitle}>
              {displayTitle}
            </strong>
          </div>

          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm shrink-0">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span className="w-2 h-2 rounded-full bg-white -ml-3.5" />
              AO VIVO
            </span>
          ) : blocked ? (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/30 border border-amber-300 text-amber-100 text-[10px] font-bold shrink-0">
              Decisão necessária
            </span>
          ) : isCompleted ? (
            <span className="px-1.5 py-0.5 rounded bg-black/35 text-emerald-200 text-[10px] font-bold shrink-0">
              ✓ Encerrado
            </span>
          ) : isReady ? (
            <span className="px-1.5 py-0.5 rounded bg-black/30 text-cyan-200 text-[10px] font-semibold shrink-0">
              Pronto
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-black/25 text-white/75 text-[10px] shrink-0">
              Aguardando
            </span>
          )}
        </div>

        {/* Two Bracket Slot Lines — Positioned so centers are at SLOT1_Y=66 and SLOT2_Y=116 */}
        <div className="mt-1.5 space-y-[6px]">
          {([0, 1] as const).map((slotIdx) => {
            const pair = slotIdx === 0 ? match.team1 : match.team2;
            const info = slotIdx === 0 ? slot1 : slot2;
            const won = slotIdx === 0 ? team1Won : team2Won;
            const scoreVal = slotIdx === 0 ? match.score1 : match.score2;
            const codeBadgeColor =
              info.kind === 'loser'
                ? 'bg-amber-400/95 text-slate-950'
                : info.kind === 'winner'
                ? 'bg-cyan-300 text-slate-950'
                : 'bg-white/20 text-white';

            return (
              <div
                key={slotIdx}
                className={`h-[44px] flex items-center justify-between gap-1.5 px-2 rounded-lg border-b-2 transition-colors ${
                  won
                    ? 'bg-white/22 text-white font-extrabold border-emerald-300 ring-1 ring-white/50'
                    : pair
                    ? 'bg-black/30 text-white/95 font-semibold border-white/35'
                    : 'bg-black/25 text-white font-semibold border-white/25'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${codeBadgeColor}`}
                    title={info.originLabel}
                  >
                    {info.code}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1 min-w-0">
                      {won && <Trophy className="w-3 h-3 text-amber-300 shrink-0" />}
                      <span className="truncate text-[11px] font-extrabold block" title={info.displayName}>
                        {info.displayName}
                      </span>
                    </div>
                    <span className="truncate text-[9.5px] text-white/75 font-medium block">
                      {pair ? info.originLabel : `Vaga reservada · ${info.code}`}
                    </span>
                  </div>
                </div>
                <strong className="text-xs font-black tabular-nums shrink-0 px-1.5 py-0.5 rounded bg-black/40 border border-white/15">
                  {scoreVal ?? '—'}
                </strong>
              </div>
            );
          })}
        </div>

        {/* Destination Routing Bar: Who goes where when Winning (V) or Losing (P) */}
        <div className="mt-1.5 flex items-center justify-between gap-1 px-1.5 py-1 rounded-md bg-black/30 text-[9.5px] leading-tight">
          <span className="font-extrabold text-cyan-200 truncate">
            {winnerDestMatch
              ? `Vence (V${match.matchNumber}) ➔ Jogo #${winnerDestMatch.matchNumber}`
              : match.stage === 'grand_final' || match.stage === 'super_final'
              ? `Vence (V${match.matchNumber}) ➔ 🏆 Campeão`
              : match.stage === 'third_place'
              ? `Vence (V${match.matchNumber}) ➔ 🥉 3º Lugar`
              : `Vence ➔ Classificado`}
          </span>
          <span className="font-bold text-amber-200 truncate shrink-0">
            {loserDestMatch
              ? `Perde (P${match.matchNumber}) ➔ Jogo #${loserDestMatch.matchNumber}`
              : match.stage === 'grand_final' || match.stage === 'super_final'
              ? `Perde ➔ 🥈 Vice`
              : match.stage === 'third_place'
              ? `Perde ➔ 4º Lugar`
              : `Perde ➔ Eliminado`}
          </span>
        </div>

        {/* Action Bar: Court info + Easy 1-click controls */}
        <div className="mt-1.5 flex items-center justify-between gap-1.5 pt-1 border-t border-white/15">
          <div className="flex items-center gap-1 min-w-0">
            {isReady && !isCompleted && onToggleLiveMatch ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLiveMatch(match);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all shrink-0 ${
                  isLive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-black/35 hover:bg-red-600/80 text-white/90'
                }`}
                title={isLive ? 'Desativar destaque Ao Vivo' : 'Destacar este jogo como AO VIVO (borda vermelha)'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-ping' : 'bg-red-400'}`} />
                {isLive ? 'Ao Vivo' : 'Iniciar Ao Vivo'}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (props.isFullscreen) props.onToggleFullscreen?.();
                  onOpenMatchEditor(match);
                }}
                className="px-2 py-0.5 rounded-md bg-black/35 hover:bg-black/50 text-white text-[10px] font-bold shrink-0"
              >
                Editar
              </button>
            )}
            <span className="text-[9.5px] text-white/80 truncate">
              {match.resultMode === 'walkover'
                ? 'W.O. · sem pontos de set'
                : match.sets?.map((set) => `${set.score1}–${set.score2}`).join(' / ') ||
                  `${match.courtName || 'Q1'}`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isReady && onQuickOfficialize && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickModal(match);
                }}
                className="px-2 py-0.5 rounded-md bg-[#FF6B00] hover:bg-[#e55f00] text-white text-[10px] font-black shadow-xs"
                title="Lançar ou corrigir resultado rapidamente"
              >
                {isCompleted ? 'Corrigir' : '⚡ Lançar'}
              </button>
            )}
            <button
              type="button"
              disabled={!match.team1 || !match.team2 || blocked}
              onClick={(e) => {
                e.stopPropagation();
                if (props.isFullscreen) props.onToggleFullscreen?.();
                onOpenRefereeModal(match.id);
              }}
              className="px-2 py-0.5 rounded-md bg-black/40 hover:bg-black/60 disabled:opacity-40 text-white text-[10px] font-bold"
              title="Abrir painel do árbitro / detalhes"
            >
              Placar
            </button>
          </div>
        </div>
      </article>
    );
  }

  const rounds = [...new Set(matches.map((match) => `${match.stage}:${match.round}`))];
  const liveCount = matches.filter(isMatchLive).length;
  const completedCount = matches.filter((m) => m.status === 'completed').length;

  const content = (
    <section
      className={
        props.isFullscreen
          ? 'bracket-fullscreen'
          : 'aquarium-glass rounded-3xl border border-cyan-400/30 p-4 sm:p-5 space-y-3.5 shadow-2xl'
      }
      role={props.isFullscreen ? 'dialog' : undefined}
      aria-modal={props.isFullscreen || undefined}
      aria-label="Tabela do campeonato"
    >
      {/* FLOATING CLOSE BUTTON WHEN IN FULLSCREEN */}
      {props.isFullscreen && (
        <button
          autoFocus
          type="button"
          className="bracket-close"
          onClick={props.onToggleFullscreen}
          aria-label="Fechar tabela em tela cheia"
        >
          <X className="w-4 h-4" />
          Fechar Tabela (Sair da Tela Cheia)
          <span className="text-xs opacity-80 ml-1 px-1.5 py-0.5 rounded bg-black/25">Esc</span>
        </button>
      )}

      {/* TOP TOOLBAR: EASY NAVIGATION, ZOOM & FULLSCREEN */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-[#031122]/90 border border-cyan-400/25 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Zone Navigation Pills */}
          {view === 'panorama' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-[#020B16] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => focusZone('winners')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/40 text-xs font-extrabold flex items-center gap-1.5"
                title="Rolar até a Chave dos Vencedores (Verde)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Vencedores (Verde)
              </button>
              <button
                type="button"
                onClick={() => focusZone('center')}
                className="px-2.5 py-1.5 rounded-lg bg-sky-950/90 hover:bg-sky-900 text-sky-200 border border-sky-400/40 text-xs font-extrabold flex items-center gap-1.5"
                title="Centralizar Semifinais, 3º Lugar e Grande Final"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                Semis & Final (Centro)
              </button>
              <button
                type="button"
                onClick={() => focusZone('losers')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-900 text-amber-200 border border-amber-400/40 text-xs font-extrabold flex items-center gap-1.5"
                title="Rolar até a Chave dos Perdedores / Repescagem (Amarelo)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Perdedores (Amarelo)
              </button>
            </div>
          )}

          {/* View Switcher (Panorama Infinity Scroll vs Columns) */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/15"
            onClick={() => {
              const next = view === 'panorama' ? 'columns' : 'panorama';
              setView(next);
              localStorage.setItem('sharkset_bracket_view', next);
            }}
          >
            {view === 'panorama' ? 'Ver por colunas' : 'Ver panorama'}
          </button>
        </div>

        {/* Zoom Controls & Fullscreen Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#020B16] p-1 rounded-xl border border-white/15">
            <button
              type="button"
              aria-label="Diminuir zoom"
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-white font-bold text-sm"
              onClick={() => zoomAt(zoom - 0.12)}
            >
              −
            </button>
            <span className="px-2 text-xs font-extrabold text-cyan-200 tabular-nums min-w-[48px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Aumentar zoom"
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-white font-bold text-sm"
              onClick={() => zoomAt(zoom + 0.12)}
            >
              +
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              onClick={fit}
            >
              Mostrar tudo
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 text-xs font-semibold"
              onClick={() => zoomAt(1)}
            >
              100%
            </button>
          </div>

          {props.onToggleFullscreen && (
            <button
              type="button"
              onClick={props.onToggleFullscreen}
              className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all ${
                props.isFullscreen
                  ? 'bg-red-600 hover:bg-red-500 text-white border border-red-300'
                  : 'bg-[#FF6B00] hover:bg-[#e55f00] text-white border border-orange-300/40'
              }`}
            >
              {props.isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  Sair da tela cheia
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  Tela cheia
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* SEARCH + VISUAL COLOR LEGEND BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-cyan-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            aria-label="Buscar dupla ou jogo"
            className="pl-9 pr-3 py-2 rounded-xl w-full border border-cyan-300/35 bg-[#031122] text-white text-xs"
            placeholder="Buscar atleta, dupla ou nº do jogo..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 font-bold">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            Cartões verdes: chave dos vencedores
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-400/50 text-amber-200 font-bold">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            Cartões amarelos: chave dos perdedores
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/90 border-2 border-red-500 text-red-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Ao Vivo ({liveCount})
          </span>
          <span className="text-slate-300 hidden sm:inline">
            Arraste para mover · Role para ampliar ({completedCount}/{matches.length} concluídos)
          </span>
        </div>
      </div>

      {/* BRACKET CONTENT: COLUMNS OR INFINITY SCROLL PANORAMA */}
      {view === 'columns' ? (
        <div className="flex items-start gap-4 overflow-auto pb-6">
          {rounds.map((key) => {
            const roundMatches = matches.filter((match) => `${match.stage}:${match.round}` === key);
            const first = roundMatches[0];
            return (
              <section key={key} className="w-72 shrink-0 space-y-3">
                <div
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border ${
                    first?.stage === 'winners'
                      ? 'bg-emerald-950/80 border-emerald-400/40 text-emerald-200'
                      : first?.stage === 'losers'
                      ? 'bg-amber-950/80 border-amber-400/40 text-amber-200'
                      : 'bg-sky-950/80 border-sky-400/40 text-sky-200'
                  }`}
                >
                  {first ? matchPhaseLabel(first) : key}
                </div>
                {roundMatches.map((match) => (
                  <div key={match.id} style={{ height: CARD_HEIGHT }}>
                    {card(match)}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div
          ref={container}
          className="bracket-viewport overflow-auto rounded-2xl border border-cyan-300/40 cursor-grab active:cursor-grabbing"
          style={{ height: props.isFullscreen ? undefined : '70vh', touchAction: 'none' }}
          onScroll={(event) => {
            viewport.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
          }}
          onDoubleClick={(event) => {
            if (!(event.target as HTMLElement).closest('button,input'))
              zoomAt(zoom * 1.4, event.clientX, event.clientY);
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button,input')) return;
            touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touches.current.size === 2) {
              const [a, b] = [...touches.current.values()];
              pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
              drag.current = null;
              return;
            }
            const element = container.current!;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              left: element.scrollLeft,
              top: element.scrollTop,
            };
            element.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!touches.current.has(event.pointerId)) return;
            touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touches.current.size === 2) {
              const [a, b] = [...touches.current.values()],
                distance = Math.hypot(a.x - b.x, a.y - b.y);
              if (pinchDistance.current > 0)
                zoomAt((zoom * distance) / pinchDistance.current, (a.x + b.x) / 2, (a.y + b.y) / 2);
              pinchDistance.current = distance;
              return;
            }
            if (!drag.current || !container.current) return;
            container.current.scrollTo(
              drag.current.left - event.clientX + drag.current.x,
              drag.current.top - event.clientY + drag.current.y
            );
          }}
          onPointerUp={(event) => {
            touches.current.delete(event.pointerId);
            drag.current = null;
            pinchDistance.current = 0;
          }}
          onPointerCancel={(event) => {
            touches.current.delete(event.pointerId);
            drag.current = null;
            pinchDistance.current = 0;
          }}
        >
          <div
            style={{
              width: layout.width * zoom,
              height: layout.height * zoom,
              position: 'relative',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                position: 'absolute',
              }}
            >
              {/* Visual Zone Header Banners on the Canvas */}
              <div
                style={{ position: 'absolute', left: 36, top: 10 }}
                className="px-4 py-1.5 rounded-full bg-emerald-950/95 border border-emerald-400/60 text-emerald-200 text-xs font-black uppercase tracking-wider shadow-lg pointer-events-none"
              >
                🟢 Chave dos Vencedores (Principal) ➔
              </div>
              <div
                style={{ position: 'absolute', left: layout.centerX, top: 10, width: CARD_WIDTH }}
                className="px-3 py-1.5 rounded-full bg-sky-950/95 border border-sky-400/60 text-sky-200 text-xs font-black uppercase tracking-wider text-center shadow-lg pointer-events-none"
              >
                🏆 Semifinais e decisões
              </div>
              <div
                style={{ position: 'absolute', right: 36, top: 10 }}
                className="px-4 py-1.5 rounded-full bg-amber-950/95 border border-amber-400/60 text-amber-200 text-xs font-black uppercase tracking-wider shadow-lg pointer-events-none"
              >
                ⬅️ 🟡 Chave dos Perdedores (Repescagem)
              </div>

              <svg
                aria-hidden="true"
                width={layout.width}
                height={layout.height}
                className="absolute inset-0 pointer-events-none"
              >
                <defs>
                  {(['winner', 'loser'] as const).map((outcome) => (
                    <marker
                      key={outcome}
                      id={`arrow-${outcome}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6.5"
                      markerHeight="6.5"
                      orient="auto-start-reverse"
                    >
                      <path
                        d="M0 0 L10 5 L0 10 z"
                        fill={outcome === 'winner' ? '#34d399' : '#fbbf24'}
                      />
                    </marker>
                  ))}
                </defs>

                {/* 1. Per-Match Classic Bracket Forks (] on Winners/Final, [ on Losers/3rd Place) & Local Entry Stubs (Sxx / Pxx) */}
                {matches.map((match) => {
                  const pos = layout.positions.get(match.id);
                  if (!pos) return null;
                  const ySlot1 = pos.y + SLOT1_Y;
                  const ySlot2 = pos.y + SLOT2_Y;
                  const yMid = pos.y + MID_Y;
                  const s1 = getSlotSourceInfo(match, 0);
                  const s2 = getSlotSourceInfo(match, 1);
                  const isDimmed = Boolean(search && !matchingIds.has(match.id));

                  if (match.stage === 'winners') {
                    const xRight = pos.x + CARD_WIDTH;
                    const xFork = xRight + 18;
                    return (
                      <g key={`fork-${match.id}`} opacity={isDimmed ? 0.22 : 0.95}>
                        {/* Seed entry lines on Round 1 left side */}
                        {([0, 1] as const).map((slotIdx) => {
                          const info = slotIdx === 0 ? s1 : s2;
                          if (info.kind !== 'team') return null;
                          const ySlot = slotIdx === 0 ? ySlot1 : ySlot2;
                          return (
                            <g key={`seed-${slotIdx}`}>
                              <path
                                d={`M${pos.x - 36},${ySlot} H${pos.x}`}
                                fill="none"
                                stroke="#34d399"
                                strokeWidth={2}
                              />
                              <rect
                                x={pos.x - 42}
                                y={ySlot - 9}
                                width={30}
                                height={18}
                                rx={4}
                                fill="#022c22"
                                stroke="#34d399"
                                strokeWidth={1.2}
                              />
                              <text
                                x={pos.x - 27}
                                y={ySlot + 3.5}
                                textAnchor="middle"
                                fill="#a7f3d0"
                                fontSize="9.5"
                                fontWeight="800"
                              >
                                {info.code}
                              </text>
                            </g>
                          );
                        })}

                        {/* Right Bracket Fork ] joining Slot 1 and Slot 2 -> V# */}
                        <path
                          d={`M${xRight},${ySlot1} H${xFork} V${ySlot2} H${xRight}`}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth={2.5}
                        />
                        <rect
                          x={xFork - 14}
                          y={yMid - 9}
                          width={32}
                          height={18}
                          rx={5}
                          fill="#022c22"
                          stroke="#34d399"
                          strokeWidth={1.3}
                        />
                        <text
                          x={xFork + 2}
                          y={yMid + 3.5}
                          textAnchor="middle"
                          fill="#6ee7b7"
                          fontSize="9.5"
                          fontWeight="900"
                        >
                          V{match.matchNumber}
                        </text>
                      </g>
                    );
                  }

                  if (match.stage === 'losers') {
                    const xLeft = pos.x;
                    const xFork = xLeft - 18;
                    const xRight = pos.x + CARD_WIDTH;
                    return (
                      <g key={`fork-${match.id}`} opacity={isDimmed ? 0.22 : 0.95}>
                        {/* Local Horizontal Entry Stubs for Losers dropping from Winners (P01..P22) */}
                        {([0, 1] as const).map((slotIdx) => {
                          const info = slotIdx === 0 ? s1 : s2;
                          if (info.kind !== 'loser') return null;
                          const ySlot = slotIdx === 0 ? ySlot1 : ySlot2;
                          return (
                            <g key={`pdrop-${slotIdx}`}>
                              <path
                                d={`M${xRight + 46},${ySlot} H${xRight}`}
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth={2.2}
                                markerEnd="url(#arrow-loser)"
                              />
                              <rect
                                x={xRight + 16}
                                y={ySlot - 9}
                                width={34}
                                height={18}
                                rx={5}
                                fill="#451a03"
                                stroke="#fbbf24"
                                strokeWidth={1.3}
                              />
                              <text
                                x={xRight + 33}
                                y={ySlot + 3.5}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize="9.5"
                                fontWeight="900"
                              >
                                {info.code}
                              </text>
                            </g>
                          );
                        })}

                        {/* Left Bracket Fork [ joining Slot 1 and Slot 2 -> V# */}
                        <path
                          d={`M${xLeft},${ySlot1} H${xFork} V${ySlot2} H${xLeft}`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={2.5}
                        />
                        <rect
                          x={xFork - 18}
                          y={yMid - 9}
                          width={32}
                          height={18}
                          rx={5}
                          fill="#451a03"
                          stroke="#fbbf24"
                          strokeWidth={1.3}
                        />
                        <text
                          x={xFork - 2}
                          y={yMid + 3.5}
                          textAnchor="middle"
                          fill="#fde68a"
                          fontSize="9.5"
                          fontWeight="900"
                        >
                          V{match.matchNumber}
                        </text>
                      </g>
                    );
                  }

                  if (match.stage === 'grand_final' || match.stage === 'super_final') {
                    const xLeft = pos.x;
                    const xRight = pos.x + CARD_WIDTH;
                    const xFork = xRight + 16;
                    return (
                      <g key={`fork-${match.id}`} opacity={isDimmed ? 0.22 : 0.95}>
                        {/* Incoming V27 & V28 local lines on the left of Final */}
                        {([0, 1] as const).map((slotIdx) => {
                          const info = slotIdx === 0 ? s1 : s2;
                          const ySlot = slotIdx === 0 ? ySlot1 : ySlot2;
                          return (
                            <g key={`final-in-${slotIdx}`}>
                              <path
                                d={`M${xLeft - 42},${ySlot} H${xLeft}`}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth={2.2}
                              />
                              <rect
                                x={xLeft - 46}
                                y={ySlot - 9}
                                width={34}
                                height={18}
                                rx={5}
                                fill="#082f49"
                                stroke="#38bdf8"
                                strokeWidth={1.3}
                              />
                              <text
                                x={xLeft - 29}
                                y={ySlot + 3.5}
                                textAnchor="middle"
                                fill="#bae6fd"
                                fontSize="9.5"
                                fontWeight="900"
                              >
                                {info.code}
                              </text>
                            </g>
                          );
                        })}
                        {/* Output Champion Bracket Fork on the right of Final */}
                        <path
                          d={`M${xRight},${ySlot1} H${xFork} V${ySlot2} H${xRight} M${xFork},${yMid} H${xFork + 58}`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={2.8}
                        />
                        <rect
                          x={xFork + 8}
                          y={yMid - 11}
                          width={74}
                          height={22}
                          rx={6}
                          fill="#451a03"
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                        />
                        <text
                          x={xFork + 45}
                          y={yMid + 4}
                          textAnchor="middle"
                          fill="#fde68a"
                          fontSize="9.5"
                          fontWeight="900"
                        >
                          V{match.matchNumber} · CAMPEÃO
                        </text>
                      </g>
                    );
                  }

                  if (match.stage === 'third_place') {
                    const xLeft = pos.x;
                    const xRight = pos.x + CARD_WIDTH;
                    const xFork = xLeft - 16;
                    return (
                      <g key={`fork-${match.id}`} opacity={isDimmed ? 0.22 : 0.95}>
                        {/* Incoming P27 & P28 local lines on the right of 3rd Place */}
                        {([0, 1] as const).map((slotIdx) => {
                          const info = slotIdx === 0 ? s1 : s2;
                          const ySlot = slotIdx === 0 ? ySlot1 : ySlot2;
                          return (
                            <g key={`third-in-${slotIdx}`}>
                              <path
                                d={`M${xRight + 42},${ySlot} H${xRight}`}
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth={2.2}
                              />
                              <rect
                                x={xRight + 12}
                                y={ySlot - 9}
                                width={34}
                                height={18}
                                rx={5}
                                fill="#451a03"
                                stroke="#fbbf24"
                                strokeWidth={1.3}
                              />
                              <text
                                x={xRight + 29}
                                y={ySlot + 3.5}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize="9.5"
                                fontWeight="900"
                              >
                                {info.code}
                              </text>
                            </g>
                          );
                        })}
                        {/* Output 3rd Place Bracket Fork on the left of 3rd Place */}
                        <path
                          d={`M${xLeft},${ySlot1} H${xFork} V${ySlot2} H${xLeft} M${xFork},${yMid} H${xFork - 58}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={2.8}
                        />
                        <rect
                          x={xFork - 82}
                          y={yMid - 11}
                          width={74}
                          height={22}
                          rx={6}
                          fill="#082f49"
                          stroke="#38bdf8"
                          strokeWidth={1.5}
                        />
                        <text
                          x={xFork - 45}
                          y={yMid + 4}
                          textAnchor="middle"
                          fill="#bae6fd"
                          fontSize="9.5"
                          fontWeight="900"
                        >
                          V{match.matchNumber} · 3º LUGAR
                        </text>
                      </g>
                    );
                  }

                  return null;
                })}

                {/* 2. Continuous Winner Progression Lines Between Rounds & Into Semifinals */}
                {edges.map((edge) => {
                  // Only draw continuous tree lines for winner progressions (never cross-bracket loser drops or Final/3rd place)
                  if (edge.outcome !== 'winner') return null;
                  const from = layout.positions.get(edge.from);
                  const to = layout.positions.get(edge.to);
                  if (!from || !to) return null;
                  const origin = matchById.get(edge.from);
                  const match = matchById.get(edge.to);
                  if (!origin || !match) return null;
                  if (match.stage === 'grand_final' || match.stage === 'super_final' || match.stage === 'third_place') {
                    return null;
                  }

                  const goingRight = from.x < to.x;
                  // Start from the tip of the origin match's bracket fork (] on right or [ on left)
                  const x1 = goingRight ? from.x + CARD_WIDTH + 18 : from.x - 18;
                  const y1 = from.y + MID_Y;

                  // End at the exact receiving slot of the target match (or side midpoint for Semifinal convergence)
                  const x2 = goingRight ? to.x : to.x + CARD_WIDTH;
                  const y2 =
                    match.stage === 'semifinals'
                      ? to.y + MID_Y
                      : to.y + (edge.slot === 0 ? SLOT1_Y : SLOT2_Y);

                  const middleX = (x1 + x2) / 2;
                  const route =
                    Math.abs(y1 - y2) < 1
                      ? `M${x1},${y1} H${x2}`
                      : `M${x1},${y1} H${middleX} V${y2} H${x2}`;

                  const isLosersSide = origin.stage === 'losers';
                  return (
                    <path
                      key={`${edge.from}-${edge.outcome}-${edge.to}`}
                      d={route}
                      fill="none"
                      stroke={isLosersSide ? '#fbbf24' : '#34d399'}
                      strokeWidth={2.5}
                      vectorEffect="non-scaling-stroke"
                      markerEnd={`url(#arrow-${isLosersSide ? 'loser' : 'winner'})`}
                      opacity={
                        search && !matchingIds.has(edge.from) && !matchingIds.has(edge.to)
                          ? 0.2
                          : 0.92
                      }
                    />
                  );
                })}
              </svg>

              {/* TOP 5 PODIUM — middle of the bracket, formatted strictly to match game card visual standards */}
              {(() => {
                const finalMatch = matches.find((m) => m.stage === 'grand_final' || m.stage === 'super_final');
                const thirdMatch = matches.find((m) => m.stage === 'third_place');
                const isTournamentFinished = Boolean(podium.first && podium.second && podium.third);

                const rows = [
                  {
                    place: 1,
                    badge: '🥇 1º',
                    badgeColor: 'bg-yellow-400 text-slate-950 font-black shadow-xs',
                    tag: 'OURO',
                    tagColor: podium.first
                      ? 'bg-yellow-400/25 text-yellow-300 border border-yellow-400/60'
                      : 'bg-black/40 text-yellow-400/70 border border-white/15',
                    team: podium.first,
                    displayName: podium.first ? formatParticipantName(podium.first) : 'A definir',
                    originLabel: podium.first
                      ? 'Campeão Oficial · Troféu de Ouro'
                      : finalMatch
                      ? `Vencedor J#${finalMatch.matchNumber} · Final`
                      : 'Vencedor da Final',
                    rowClass: podium.first
                      ? 'bg-yellow-500/20 text-white font-extrabold border-b-2 border-yellow-400 ring-1 ring-yellow-400/50'
                      : 'bg-black/30 text-white/80 font-semibold border-b-2 border-white/20',
                  },
                  {
                    place: 2,
                    badge: '🥈 2º',
                    badgeColor: 'bg-slate-200 text-slate-900 font-black shadow-xs',
                    tag: 'PRATA',
                    tagColor: podium.second
                      ? 'bg-slate-300/25 text-slate-200 border border-slate-300/60'
                      : 'bg-black/40 text-slate-300/70 border border-white/15',
                    team: podium.second,
                    displayName: podium.second ? formatParticipantName(podium.second) : 'A definir',
                    originLabel: podium.second
                      ? 'Vice-Campeão · Troféu de Prata'
                      : finalMatch
                      ? `Perdedor J#${finalMatch.matchNumber} · Final`
                      : 'Perdedor da Final',
                    rowClass: podium.second
                      ? 'bg-slate-300/20 text-white font-extrabold border-b-2 border-slate-300 ring-1 ring-slate-300/40'
                      : 'bg-black/25 text-white/75 font-semibold border-b-2 border-white/15',
                  },
                  {
                    place: 3,
                    badge: '🥉 3º',
                    badgeColor: 'bg-amber-600 text-white font-black shadow-xs',
                    tag: 'BRONZE',
                    tagColor: podium.third
                      ? 'bg-amber-600/30 text-amber-200 border border-amber-500/60'
                      : 'bg-black/40 text-amber-400/70 border border-white/15',
                    team: podium.third,
                    displayName: podium.third ? formatParticipantName(podium.third) : 'A definir',
                    originLabel: podium.third
                      ? '3º Colocado · Troféu de Bronze'
                      : thirdMatch
                      ? `Vencedor J#${thirdMatch.matchNumber} · 3º/4º`
                      : 'Vencedor Disputa 3º',
                    rowClass: podium.third
                      ? 'bg-amber-600/20 text-white font-extrabold border-b-2 border-amber-500 ring-1 ring-amber-500/40'
                      : 'bg-black/25 text-white/75 font-semibold border-b-2 border-white/15',
                  },
                  {
                    place: 4,
                    badge: '4º',
                    badgeColor: 'bg-slate-700 text-slate-200 font-black',
                    tag: '4º',
                    tagColor: 'bg-black/40 text-slate-300 border border-white/15',
                    team: podium.fourth,
                    displayName: podium.fourth ? formatParticipantName(podium.fourth) : 'A definir',
                    originLabel: podium.fourth
                      ? '4º Colocado · Semifinalista'
                      : thirdMatch
                      ? `Perdedor J#${thirdMatch.matchNumber} · 3º/4º`
                      : 'Perdedor Disputa 3º',
                    rowClass: podium.fourth
                      ? 'bg-white/10 text-white font-semibold border-b-2 border-white/30'
                      : 'bg-black/20 text-white/70 font-medium border-b-2 border-white/10',
                  },
                  {
                    place: 5,
                    badge: '5º',
                    badgeColor: 'bg-slate-800 text-slate-300 font-black',
                    tag: '5º',
                    tagColor: 'bg-black/40 text-slate-400 border border-white/15',
                    team: podium.fifth[0],
                    displayName:
                      podium.fifth.length > 0
                        ? podium.fifth.map(formatParticipantName).join(' / ')
                        : 'A definir',
                    originLabel:
                      podium.fifth.length > 1
                        ? '5º Lugar (Empate Técnico)'
                        : podium.fifth.length === 1
                        ? '5º Colocado · Quartas de Final'
                        : 'Quartas de Final',
                    rowClass:
                      podium.fifth.length > 0
                        ? 'bg-white/10 text-white font-semibold border-b-2 border-white/25'
                        : 'bg-black/20 text-white/60 font-medium border-b-2 border-white/10',
                  },
                ];

                return (
                  <article
                    className="bracket-podium"
                    aria-label="Pódio: 5 primeiros colocados"
                    style={{
                      left: layout.podium.x,
                      top: layout.podium.y,
                      width: layout.podium.width,
                      height: layout.podium.height,
                    }}
                  >
                    {/* Top Header: Game Card Pattern (Match Code pill + Title + Status badge) */}
                    <div className="flex items-center justify-between gap-1.5 text-[11px] leading-tight h-[26px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md font-black text-[10px] shrink-0 bg-yellow-400 text-slate-950 flex items-center gap-1 shadow-xs">
                          <Trophy className="w-3 h-3 text-slate-950" />
                          PÓDIO
                        </span>
                        <strong className="truncate text-white font-extrabold text-[11px] uppercase tracking-wide">
                          5 Primeiros Colocados
                        </strong>
                      </div>

                      {isTournamentFinished ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-1">
                          ✓ Finalizado
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-amber-400/30 text-amber-200 text-[10px] font-semibold shrink-0">
                          Em disputa
                        </span>
                      )}
                    </div>

                    {/* 5 Slot Rows: Strictly matching the 2-slot Game Card anatomy */}
                    <div className="mt-1 space-y-[4px]">
                      {rows.map((row) => (
                        <div
                          key={row.place}
                          className={`h-[36px] flex items-center justify-between gap-1.5 px-2 rounded-lg transition-colors ${row.rowClass}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${row.badgeColor}`}>
                              {row.badge}
                            </span>
                            <div className="min-w-0 flex-1 leading-tight">
                              <div className="flex items-center gap-1 min-w-0">
                                {row.team && row.place === 1 && (
                                  <Trophy className="w-3 h-3 text-amber-300 shrink-0" />
                                )}
                                <span
                                  className={`truncate text-[11px] font-extrabold block ${
                                    row.team ? 'text-white' : 'text-white/70'
                                  }`}
                                  title={row.displayName}
                                >
                                  {row.displayName}
                                </span>
                              </div>
                              <span className="truncate text-[9px] text-white/75 font-medium block">
                                {row.originLabel}
                              </span>
                            </div>
                          </div>
                          <strong
                            className={`text-[10px] font-black tabular-nums shrink-0 px-1.5 py-0.5 rounded ${row.tagColor}`}
                          >
                            {row.tag}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Destination/Official Award Bar: Matching Game Card Footer Pattern */}
                    <div className="mt-1 flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md bg-black/40 text-[9.5px] leading-tight border border-white/10">
                      <span className="font-extrabold text-amber-300 truncate flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                        Premiação Oficial
                      </span>
                      <span className="font-bold text-cyan-200 truncate shrink-0">
                        Ranking SharkSet
                      </span>
                    </div>
                  </article>
                );
              })()}

              {matches.map((match) => {
                const pos = layout.positions.get(match.id)!;
                return (
                  <div
                    key={match.id}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                    }}
                  >
                    {card(match)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QUICK SCORE ENTRY MODAL (WORKS SEAMLESSLY IN NORMAL & FULLSCREEN MODES) */}
      {quickModalMatch && onQuickOfficialize && (
        <div
          className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={() => setQuickModalMatchId(null)}
        >
          <div
            className="aquarium-glass bg-[#061A30] border-2 border-cyan-400/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <span className="text-[11px] font-black uppercase text-cyan-300">
                  Jogo #{quickModalMatch.matchNumber} · {matchPhaseLabel(quickModalMatch)}
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Lançar Resultado Rápido
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickModalMatchId(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-[#030E1B] p-3 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 font-bold">Dupla 1:</span>
                <strong className="text-white">{formatParticipantName(quickModalMatch.team1)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300 font-bold">Dupla 2:</span>
                <strong className="text-white">{formatParticipantName(quickModalMatch.team2)}</strong>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                Regra deste jogo: Melhor de {matchRules(quickModalMatch).bestOf} set(s) · Alvo{' '}
                {matchRules(quickModalMatch).targetPoints} pts (diferença mín.{' '}
                {matchRules(quickModalMatch).winBy})
              </p>
            </div>

            {/* Quick 1-Click Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-300 block">
                Atalhos rápidos de placar:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const rules = matchRules(quickModalMatch);
                    const needed = Math.ceil(rules.bestOf / 2);
                    setQuickSets(
                      Array.from({ length: needed }, () => ({
                        score1: rules.targetPoints,
                        score2: Math.max(0, rules.targetPoints - 4),
                      }))
                    );
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-400/50 text-emerald-100 font-bold text-left"
                >
                  🏆 Vitória Dupla 1 ({matchRules(quickModalMatch).targetPoints}×
                  {Math.max(0, matchRules(quickModalMatch).targetPoints - 4)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rules = matchRules(quickModalMatch);
                    const needed = Math.ceil(rules.bestOf / 2);
                    setQuickSets(
                      Array.from({ length: needed }, () => ({
                        score1: Math.max(0, rules.targetPoints - 4),
                        score2: rules.targetPoints,
                      }))
                    );
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-900/70 hover:bg-amber-800 border border-amber-400/50 text-amber-100 font-bold text-left"
                >
                  🏆 Vitória Dupla 2 ({Math.max(0, matchRules(quickModalMatch).targetPoints - 4)}×
                  {matchRules(quickModalMatch).targetPoints})
                </button>
              </div>
            </div>

            {/* Sets Inputs */}
            <div className="space-y-2">
              {quickSets.map((set, index) => (
                <div key={index} className="flex items-center justify-between gap-2 bg-[#030E1B] p-2.5 rounded-xl border border-white/10">
                  <span className="text-xs font-bold text-slate-200">Set {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={set.score1}
                      onChange={(e) =>
                        setQuickSets((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, score1: Number(e.target.value) } : s))
                        )
                      }
                      className="w-16 p-1.5 text-center font-bold rounded-lg border border-cyan-400/40 bg-[#061A30] text-white"
                    />
                    <span className="text-xs font-bold text-slate-400">×</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={set.score2}
                      onChange={(e) =>
                        setQuickSets((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, score2: Number(e.target.value) } : s))
                        )
                      }
                      className="w-16 p-1.5 text-center font-bold rounded-lg border border-amber-400/40 bg-[#061A30] text-white"
                    />
                  </div>
                </div>
              ))}

              {matchRules(quickModalMatch).bestOf > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={quickSets.length >= matchRules(quickModalMatch).bestOf}
                    onClick={() =>
                      setQuickSets((prev) => [
                        ...prev,
                        { score1: matchRules(quickModalMatch).decidingPoints, score2: Math.max(0, matchRules(quickModalMatch).decidingPoints - 2) },
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold disabled:opacity-40"
                  >
                    + Adicionar 3º Set (Tie-break)
                  </button>
                  {quickSets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuickSets((prev) => prev.slice(0, -1))}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                    >
                      − Remover último set
                    </button>
                  )}
                </div>
              )}
            </div>

            {quickError && (
              <p className="text-xs text-red-300 bg-red-950/60 border border-red-500/50 p-2.5 rounded-xl">
                {quickError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/15">
              <button
                type="button"
                onClick={() => setQuickModalMatchId(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    onQuickOfficialize(quickModalMatch, quickSets);
                    setQuickModalMatchId(null);
                  } catch (err) {
                    setQuickError(err instanceof Error ? err.message : 'Placar inválido.');
                  }
                }}
                className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e55f00] text-white text-xs font-black shadow-lg"
              >
                ✓ Confirmar e Avançar na Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  return props.isFullscreen ? createPortal(content, document.body) : content;
};
