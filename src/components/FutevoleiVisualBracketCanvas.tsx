import React, { useState, useRef } from 'react';
import { BracketMatch, SemiFormat, TeamPair } from '../types';
import {
  Trophy,
  ShieldAlert,
  Sliders,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Move,
  ArrowRight,
  CornerDownRight,
  Radio,
  Share2,
  Swords,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  knockoutOnlyMode?: boolean;
  onToggleKnockoutOnlyMode?: () => void;
}

export const FutevoleiVisualBracketCanvas: React.FC<FutevoleiVisualBracketCanvasProps> = ({
  matches,
  semiFormat,
  isSingles,
  formatParticipantName,
  getInlineScore,
  onInlineScoreChange,
  onInlineSubmit,
  onOpenRefereeModal,
  onOpenMatchEditor,
  onSelectMatchCard,
  onCallMatchCourt,
  onShareMatch,
  onHistoryMatch,
  isFullscreen = false,
  onToggleFullscreen,
  knockoutOnlyMode = false,
  onToggleKnockoutOnlyMode,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [startY, setStartY] = useState<number>(0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number>(1);
  const [showPastMatchesInKnockout, setShowPastMatchesInKnockout] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const winnersR1 = matches.filter((m) => m.stage === 'winners' && m.round === 1);
  const winnersR2 = matches.filter((m) => m.stage === 'winners' && m.round === 2);
  const winnersR3 = matches.filter((m) => m.stage === 'winners' && m.round === 3);

  const losersR1 = matches.filter((m) => m.stage === 'losers' && m.round === 1);
  const losersR2 = matches.filter((m) => m.stage === 'losers' && m.round === 2);
  const losersR3 = matches.filter((m) => m.stage === 'losers' && m.round === 3);
  const losersR4 = matches.filter((m) => m.stage === 'losers' && m.round === 4);

  const semiMatches = matches.filter((m) => m.stage === 'semifinals');
  const thirdPlaceMatches = matches.filter(
    (m) => m.stage === 'third_place' || m.stageName.toLowerCase().includes('3º lugar')
  );
  const finalMatches = matches.filter((m) => m.stage === 'grand_final' || m.stage === 'super_final');

  const pastQualifyingMatches = matches.filter(
    (m) =>
      (m.stage === 'winners' || m.stage === 'losers') &&
      !m.stageName.toLowerCase().includes('3º lugar')
  );

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'button', 'select', 'svg', 'path'].includes(tag)) return;
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setStartY(e.pageY - scrollContainerRef.current.offsetTop);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    setScrollTop(scrollContainerRef.current.scrollTop);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const y = e.pageY - scrollContainerRef.current.offsetTop;
    const walkX = (x - startX) * 1.3;
    const walkY = (y - startY) * 1.3;
    scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
    scrollContainerRef.current.scrollTop = scrollTop - walkY;
  };

  const stopDragging = () => {
    setIsDragging(false);
    setTouchStartDist(null);
  };

  const handleTouchEnd = () => {
    stopDragging();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'button', 'select'].includes(targetTag)) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setStartX(touch.pageX - scrollContainerRef.current.offsetLeft);
      setStartY(touch.pageY - scrollContainerRef.current.offsetTop);
      setScrollLeft(scrollContainerRef.current.scrollLeft);
      setScrollTop(scrollContainerRef.current.scrollTop);
      setTouchStartDist(null);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setTouchStartDist(dist);
      setInitialZoom(zoom);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;

    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const x = touch.pageX - scrollContainerRef.current.offsetLeft;
      const y = touch.pageY - scrollContainerRef.current.offsetTop;
      const walkX = (x - startX) * 1.4;
      const walkY = (y - startY) * 1.4;
      scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
      scrollContainerRef.current.scrollTop = scrollTop - walkY;
    } else if (e.touches.length === 2 && touchStartDist) {
      const newDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const scale = newDist / touchStartDist;
      const nextZoom = Math.min(1.4, Math.max(0.45, Number((initialZoom * scale).toFixed(2))));
      setZoom(nextZoom);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((z) => Math.min(1.4, Math.max(0.45, Number((z + delta).toFixed(2)))));
    }
  };

  const handleFitToScreen = () => {
    if (!scrollContainerRef.current) return;
    const containerWidth = scrollContainerRef.current.clientWidth;
    const targetWidth = knockoutOnlyMode ? 760 : 1380;
    const idealZoom = Math.min(1, Math.max(0.5, Number((containerWidth / targetWidth).toFixed(2))));
    setZoom(idealZoom);
    scrollContainerRef.current.scrollLeft = 0;
    scrollContainerRef.current.scrollTop = 0;
  };

  const getMatchNumberById = (matchId?: string) => {
    if (!matchId) return null;
    const found = matches.find((m) => m.id === matchId);
    return found ? found.matchNumber : null;
  };

  /**
   * Renders a bracket match card with soft green for Winners Bracket, soft red for Losers Bracket,
   * and Sharkset Blue for Knockout (Semifinals, 3rd Place & Final).
   */
  const renderBracketNode = (
    match: BracketMatch,
    bracketTone: 'winners_green' | 'losers_red' | 'knockout_blue'
  ) => {
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'in_progress';
    const isReady = !!match.team1 && !!match.team2;
    const team1Won = isCompleted && match.winnerId === match.team1?.id;
    const team2Won = isCompleted && match.winnerId === match.team2?.id;

    const nextWinNum = getMatchNumberById(match.nextMatchWinnerId);
    const nextLoseNum = getMatchNumberById(match.nextMatchLoserId);
    const currentServer =
      match.liveReferee?.serviceOrderLabels?.[match.liveReferee.serverRotationIndex];
    const yellowCardsCount = match.liveReferee?.cardsHistory?.length || 0;

    // Soft Green for Winners Bracket, Soft Red for Losers Bracket, Sharkset Blue for Semis/Final/3rd Place
    const cardToneClass = isLive
      ? 'border-rose-500 ring-2 ring-rose-500/40 bg-[#071D3D]'
      : bracketTone === 'winners_green'
      ? 'bg-emerald-950/35 border-emerald-500/40 hover:border-emerald-400/75 shadow-emerald-950/30'
      : bracketTone === 'losers_red'
      ? 'bg-rose-950/35 border-rose-500/40 hover:border-rose-400/75 shadow-rose-950/30'
      : 'bg-[#071D3D] border-[#0987CE]/60 hover:border-[#12C7BB]';

    const headerToneClass = isLive
      ? 'bg-rose-950/70 text-rose-200 border-b border-rose-500/40'
      : bracketTone === 'winners_green'
      ? 'bg-emerald-950/65 text-emerald-200 border-b border-emerald-500/25'
      : bracketTone === 'losers_red'
      ? 'bg-rose-950/65 text-rose-200 border-b border-rose-500/25'
      : 'bg-[#030B17] text-[#5BC3FA] border-b border-[#145A9B]';

    const badgeToneClass =
      bracketTone === 'winners_green'
        ? 'bg-emerald-600/80 text-white'
        : bracketTone === 'losers_red'
        ? 'bg-rose-600/80 text-white'
        : 'bg-[#0987CE] text-white';

    return (
      <div
        key={match.id}
        data-match-id={match.id}
        data-winner-id={match.winnerId || ''}
        onClick={() => onSelectMatchCard && onSelectMatchCard(match)}
        className={`bracket-match-node relative w-[290px] sm:w-[315px] rounded-2xl border-2 shadow-md transition-all shrink-0 cursor-pointer group ${cardToneClass}`}
      >
        {/* Top Match Number & Quick Referee / Edit Header */}
        <div className={`px-3 py-2 rounded-t-xl flex items-center justify-between text-[11px] ${headerToneClass}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] shrink-0 ${badgeToneClass}`}>
              JOGO {match.matchNumber}
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase animate-pulse shrink-0">
                <Radio className="w-2.5 h-2.5" />
                AO VIVO
              </span>
            )}
            <span className="font-mono text-[10px] opacity-90 truncate">
              {match.courtName?.split(' - ')[0] || 'Quadra 1'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onSelectMatchCard && (
              <button
                type="button"
                onClick={() => onSelectMatchCard(match)}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] flex items-center gap-0.5 cursor-pointer transition-colors"
                title="Abrir página da partida em tempo real (Chat, Saque, Juiz, Histórico de Pontos)"
              >
                <Eye className="w-2.5 h-2.5 text-[#12C7BB]" />
                Tempo Real
              </button>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => onOpenRefereeModal(match.id)}
                className="px-1.5 py-0.5 rounded bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[10px] flex items-center gap-0.5 cursor-pointer shadow-xs"
                title="Abrir Súmula do Árbitro (Saque, Tempo, Cartão)"
              >
                <ShieldAlert className="w-2.5 h-2.5" />
                Juiz
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenMatchEditor(match)}
              className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
              title="Posicionar dupla manualmente ou editar horário"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Live Referee & Server Info Strip */}
        <div className="px-3 py-1 bg-[#030B17]/80 text-[10px] text-slate-300 font-semibold flex items-center justify-between border-b border-white/10">
          <span className="truncate text-[#12C7BB]">
            🏐 {currentServer ? `Saque: ${currentServer.split(':')[1] || currentServer}` : `Juiz: ${match.liveReferee?.refereeName || 'Oficial SHARK SET'}`}
          </span>
          <span className="text-[9px] text-slate-400 group-hover:text-white transition-colors flex items-center gap-1 shrink-0">
            <MessageSquare className="w-2.5 h-2.5 text-[#0987CE]" />
            Chat & Lances →
          </span>
        </div>

        {/* Match Participants & Inline Score Form */}
        <form
          onSubmit={(e) => {
            e.stopPropagation();
            onInlineSubmit(match, e);
          }}
          className="p-2.5 space-y-1.5"
        >
          {/* Slot 1 */}
          <div
            data-slot-winner={team1Won ? 'true' : 'false'}
            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition-colors ${
              team1Won
                ? 'bg-[#0987CE]/30 border-[#12C7BB] font-black text-white'
                : 'bg-[#030B17]/90 border-[#145A9B]/60 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate pr-2 flex-1">
              <span className="px-1.5 py-0.5 rounded bg-[#071D3D] text-[#5BC3FA] font-mono font-bold text-[10px] shrink-0 border border-[#145A9B]">
                {match.team1 ? `#${match.team1.seed}` : 'A1'}
              </span>
              <span className="truncate font-bold">
                {match.team1 ? formatParticipantName(match.team1) : 'Aguardando Dupla...'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {team1Won && <Trophy className="w-3.5 h-3.5 text-[#12C7BB] shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's1')}
                onChange={(e) => onInlineScoreChange(match, 's1', e.target.value)}
                className="w-11 h-7 text-center font-mono font-black text-xs bg-[#071D3D] text-white border border-[#145A9B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE] tabular-nums"
              />
            </div>
          </div>

          {/* Slot 2 */}
          <div
            data-slot-winner={team2Won ? 'true' : 'false'}
            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition-colors ${
              team2Won
                ? 'bg-[#0987CE]/30 border-[#12C7BB] font-black text-white'
                : 'bg-[#030B17]/90 border-[#145A9B]/60 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate pr-2 flex-1">
              <span className="px-1.5 py-0.5 rounded bg-[#071D3D] text-[#5BC3FA] font-mono font-bold text-[10px] shrink-0 border border-[#145A9B]">
                {match.team2 ? `#${match.team2.seed}` : 'B1'}
              </span>
              <span className="truncate font-bold">
                {match.team2 ? formatParticipantName(match.team2) : 'Aguardando Dupla...'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {team2Won && <Trophy className="w-3.5 h-3.5 text-[#12C7BB] shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's2')}
                onChange={(e) => onInlineScoreChange(match, 's2', e.target.value)}
                className="w-11 h-7 text-center font-mono font-black text-xs bg-[#071D3D] text-white border border-[#145A9B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE] tabular-nums"
              />
            </div>
          </div>

          {/* Footer: Routing + MVP + Confirm */}
          <div
            className="pt-1 flex items-center justify-between gap-1 text-[10px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1 text-slate-300 font-semibold truncate">
              {nextWinNum && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#0987CE]/20 text-[#5BC3FA] border border-[#0987CE]/40 font-bold">
                  <ArrowRight className="w-2.5 h-2.5" />
                  Venc: J{nextWinNum}
                </span>
              )}
              {nextLoseNum ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#030B17] text-slate-300 border border-[#145A9B] font-bold">
                  <CornerDownRight className="w-2.5 h-2.5" />
                  Perd: J{nextLoseNum}
                </span>
              ) : match.stage === 'losers' ? (
                <span className="px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-200 border border-rose-500/30 font-bold">
                  Perdeu = Eliminado
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isCompleted && onHistoryMatch && (
                <button
                  type="button"
                  onClick={() => onHistoryMatch(match)}
                  className="px-2 py-1 rounded-lg bg-[#12C7BB]/20 hover:bg-[#12C7BB]/35 border border-[#12C7BB]/50 text-[#12C7BB] font-black text-[10px] cursor-pointer transition-colors"
                  title="Votar no MVP (Craque da Partida)"
                >
                  🗳️ MVP
                </button>
              )}
              {isReady && (
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[10px] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Check className="w-2.5 h-2.5" />
                  {isCompleted ? 'Salvar' : 'Confirmar'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="aquarium-glass bg-[#030B17] border-2 border-[#145A9B] rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Infinity-Scroll & Fullscreen Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#071D3D] text-[#F7FAFD] border-b border-[#145A9B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black text-[11px] uppercase shadow-xs">
            CHAVEAMENTO OFICIAL (CLIQUE NO JOGO P/ TEMPO REAL & CHAT)
          </span>
          {/* Visual Color Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Chave Vencedores (Verde Suave)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Chave Perdedores / Repescagem (Vermelho Suave)
            </span>
          </div>
        </div>

        {/* Zoom, Knockout Toggle & Fullscreen Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#030B17] p-1.5 rounded-xl border border-[#145A9B] text-xs">
          {onToggleKnockoutOnlyMode && (
            <button
              type="button"
              onClick={onToggleKnockoutOnlyMode}
              className={`px-2.5 py-1 rounded-lg font-black text-[11px] cursor-pointer flex items-center gap-1 transition-all border ${
                knockoutOnlyMode
                  ? 'bg-[#12C7BB] text-slate-950 border-[#12C7BB]'
                  : 'bg-[#071D3D] text-[#12C7BB] border-[#145A9B] hover:bg-[#0B254E]'
              }`}
              title="Quando chega na Semifinal, minimiza os jogos passados e foca no Mata-Mata (Semis, Final e 3º Lugar)"
            >
              <Trophy className="w-3 h-3" />
              {knockoutOnlyMode ? 'Mata-Mata Ativo (Ver Completa)' : 'Focar Mata-Mata (Semi/Final/3º)'}
            </button>
          )}

          <button
            type="button"
            onClick={handleFitToScreen}
            className="px-2.5 py-1 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[11px] cursor-pointer flex items-center gap-1 shadow-xs transition-all"
            title="Ajustar automaticamente toda a chave à tela do celular ou monitor"
          >
            <Move className="w-3 h-3" />
            Ajustar Zoom
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-[#071D3D] text-slate-300 hover:text-white cursor-pointer"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-1.5 font-mono font-black text-[#12C7BB] min-w-[44px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-[#071D3D] text-slate-300 hover:text-white cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-[11px] cursor-pointer flex items-center gap-1 shadow-sm"
              title={isFullscreen ? 'Sair da Tela Cheia (ESC)' : 'Expandir Tabela em Tela Cheia'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3 h-3" />
                  Sair da Tela Cheia
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3" />
                  Tela Cheia
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODO MATA-MATA (QUANDO O TORNEIO CHEGA NA SEMIFINAL):               */}
      {/* Minimiza jogos passados e mostra Semifinais, Final e 3º Lugar!      */}
      {/* =================================================================== */}
      {knockoutOnlyMode && (
        <div className="bg-[#071D3D]/90 border-b border-[#145A9B] px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded bg-[#12C7BB] text-slate-950 font-black text-[10px] uppercase">
              FASE FINAL · MATA-MATA PURO
            </span>
            <span className="text-slate-200 font-semibold">
              Os {pastQualifyingMatches.length} jogos classificatórios anteriores foram minimizados para focar nas <strong>Semifinais, Grande Final e Disputa de 3º Lugar</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPastMatchesInKnockout((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#5BC3FA] font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            {showPastMatchesInKnockout ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Minimizar Jogos Passados ({pastQualifyingMatches.length})
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Ver Jogos Passados Minimizados ({pastQualifyingMatches.length})
              </>
            )}
          </button>
        </div>
      )}

      {/* Collapsible Summary of Past Matches when in Knockout Mode */}
      {knockoutOnlyMode && showPastMatchesInKnockout && (
        <div className="bg-[#030B17] border-b border-[#145A9B] p-4 space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
            Resumo Compacto dos Jogos Classificatórios Anteriores (Clique em qualquer jogo para abrir em Tempo Real):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {pastQualifyingMatches.map((pm) => {
              const isWinBracket = pm.stage === 'winners';
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => onSelectMatchCard && onSelectMatchCard(pm)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    isWinBracket
                      ? 'bg-emerald-950/30 border-emerald-500/35 hover:border-emerald-400'
                      : 'bg-rose-950/30 border-rose-500/35 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                    <span className={isWinBracket ? 'text-emerald-300' : 'text-rose-300'}>
                      Jogo #{pm.matchNumber} · {isWinBracket ? 'Vencedores' : 'Perdedores'}
                    </span>
                    <span className="font-mono text-white font-black">
                      {pm.score1 ?? 0} x {pm.score2 ?? 0}
                    </span>
                  </div>
                  <div className="truncate text-slate-200 font-semibold text-[11px]">
                    {pm.team1 ? formatParticipantName(pm.team1) : 'A definir'}
                  </div>
                  <div className="truncate text-slate-400 text-[11px]">
                    vs {pm.team2 ? formatParticipantName(pm.team2) : 'A definir'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Horizontal & Vertical Infinity Scroll Viewport */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className={`overflow-x-auto overflow-y-auto ${
          isFullscreen ? 'max-h-[calc(100vh-140px)]' : 'max-h-[82vh]'
        } p-5 sm:p-8 bg-[#040E1C] select-none touch-pan-x touch-pan-y ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          className="min-w-max space-y-10 pb-8 pr-12 transition-transform duration-150"
        >
          {knockoutOnlyMode ? (
            /* =============================================================== */
            /* TABELA COMUM DE MATA-MATA: SEMIFINAIS, FINAL E 3º LUGAR         */
            /* =============================================================== */
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b-2 border-[#0987CE]/40 pb-3">
                <span className="px-3 py-1 rounded-lg bg-[#0987CE] text-white font-black text-xs uppercase tracking-wider">
                  CHAVEAMENTO MATA-MATA · SEMIFINAIS, GRANDE FINAL & DISPUTA DE 3º LUGAR
                </span>
                <span className="text-xs font-bold text-slate-300">
                  Vencedores das Semifinais disputam o Título · Perdedores das Semifinais disputam o 3º Lugar
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-stretch gap-8 lg:gap-14">
                {/* Coluna 1: Semifinais (Mata-Mata) */}
                <div className="flex flex-col justify-around space-y-6">
                  <div className="px-3.5 py-2 rounded-xl bg-[#071D3D] text-[#5BC3FA] border border-[#0987CE]/50 font-black text-xs uppercase tracking-wider text-center">
                    ⚡ Semifinais do Torneio (Mata-Mata)
                  </div>
                  <div className="flex flex-col justify-around gap-8 flex-1">
                    {(semiMatches.length > 0 ? semiMatches : winnersR2).map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'knockout_blue')}
                        <div className="hidden md:flex items-center w-10 lg:w-14">
                          <div className="h-0.5 w-full bg-[#0987CE]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coluna 2: Grande Final + Disputa de 3º Lugar */}
                <div className="flex flex-col justify-between space-y-8">
                  {/* Grande Final */}
                  <div className="space-y-3">
                    <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] text-slate-950 font-black text-xs uppercase tracking-wider text-center shadow-md">
                      🏆 GRANDE FINAL (1º E 2º LUGAR)
                    </div>
                    <div className="flex flex-col justify-center">
                      {finalMatches.map((m) => (
                        <div key={m.id} className="relative flex items-center">
                          {renderBracketNode(m, 'knockout_blue')}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Disputa de 3º Lugar */}
                  {thirdPlaceMatches.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-[#145A9B]/60">
                      <div className="px-3.5 py-2 rounded-xl bg-[#071D3D] text-[#12C7BB] border border-[#12C7BB]/50 font-black text-xs uppercase tracking-wider text-center">
                        🥉 DISPUTA DE 3º LUGAR (PERDEDORES DAS SEMIS)
                      </div>
                      <div className="flex flex-col justify-center">
                        {thirdPlaceMatches.map((m) => (
                          <div key={m.id} className="relative flex items-center">
                            {renderBracketNode(m, 'knockout_blue')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* TABELA COMPLETA: CHAVE VENCEDORES (VERDE) + PERDEDORES (VERMELHO)*/
            /* =============================================================== */
            <>
              {/* PARTE SUPERIOR: CHAVE DOS VENCEDORES (VERDE SUAVE) + FASE FINAL */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-emerald-500/30 pb-2">
                  <span className="px-3 py-1 rounded-lg bg-emerald-600/90 text-white font-black text-xs uppercase tracking-wider">
                    CHAVE DOS VENCEDORES (INVICTOS · VERDE)
                  </span>
                  <span className="text-xs font-bold text-emerald-300/90">
                    Quem vence avança na chave principal · Quem perde 1x cai para a Chave dos Perdedores (Vermelho) abaixo
                  </span>
                </div>

                <div className="flex items-stretch gap-8 lg:gap-12">
                  {/* Coluna 1: 1ª Fase / Quartas (Jogos 1 a 4) */}
                  {winnersR1.length > 0 && (
                    <div className="flex flex-col justify-around space-y-5">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 font-black text-xs uppercase tracking-wider text-center">
                        1ª Rodada · Chave dos Vencedores ({winnersR1.length} Jogos)
                      </div>
                      <div className="flex flex-col justify-around gap-6 flex-1">
                        {winnersR1.map((m) => (
                          <div key={m.id} className="relative flex items-center">
                            {renderBracketNode(m, 'winners_green')}
                            <div className="hidden sm:flex items-center w-8 lg:w-12">
                              <div className="h-0.5 w-full bg-emerald-500/50" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coluna 2: 2ª Fase Vencedores (Jogos 7 e 8) */}
                  {winnersR2.length > 0 && (
                    <div className="flex flex-col justify-around space-y-5">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 font-black text-xs uppercase tracking-wider text-center">
                        {semiFormat === 'semi_direta'
                          ? '2ª Rodada Vencedores · Vale Vaga na Semi (J7 e J8)'
                          : '2ª Rodada · Semifinal Vencedores (J7 e J8)'}
                      </div>
                      <div className="flex flex-col justify-around gap-12 flex-1">
                        {winnersR2.map((m) => (
                          <div key={m.id} className="relative flex items-center">
                            {renderBracketNode(m, 'winners_green')}
                            <div className="hidden sm:flex items-center w-8 lg:w-12">
                              <div className="h-0.5 w-full bg-emerald-500/50" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coluna 3 (Se Semi com Chance): Final Vencedores */}
                  {semiFormat === 'semi_com_chance' && winnersR3.length > 0 && (
                    <div className="flex flex-col justify-around space-y-5">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 font-black text-xs uppercase tracking-wider text-center">
                        Final dos Vencedores (J11)
                      </div>
                      <div className="flex flex-col justify-around flex-1">
                        {winnersR3.map((m) => (
                          <div key={m.id} className="relative flex items-center">
                            {renderBracketNode(m, 'winners_green')}
                            <div className="hidden sm:flex items-center w-8 lg:w-12">
                              <div className="h-0.5 w-full bg-[#0987CE]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coluna Semifinais Diretas */}
                  {semiFormat === 'semi_direta' && semiMatches.length > 0 && (
                    <div className="flex flex-col justify-around space-y-5">
                      <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#5BC3FA] font-black text-xs uppercase tracking-wider text-center border border-[#0987CE]/60">
                        ⚡ Semifinais (Mata-Mata)
                      </div>
                      <div className="flex flex-col justify-around gap-12 flex-1">
                        {semiMatches.map((m) => (
                          <div key={m.id} className="relative flex items-center">
                            {renderBracketNode(m, 'knockout_blue')}
                            <div className="hidden sm:flex items-center w-8 lg:w-12">
                              <div className="h-0.5 w-full bg-[#0987CE]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coluna Grande Final & Disputa de 3º Lugar */}
                  {finalMatches.length > 0 && (
                    <div className="flex flex-col justify-around space-y-6">
                      <div className="space-y-3">
                        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] text-slate-950 font-black text-xs uppercase tracking-wider text-center shadow-md">
                          🏆 GRANDE FINAL DO TORNEIO
                        </div>
                        <div className="flex flex-col justify-around">
                          {finalMatches.map((m) => (
                            <div key={m.id} className="relative flex items-center">
                              {renderBracketNode(m, 'knockout_blue')}
                            </div>
                          ))}
                        </div>
                      </div>

                      {thirdPlaceMatches.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-[#145A9B]/60">
                          <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#12C7BB] border border-[#12C7BB]/50 font-black text-xs uppercase tracking-wider text-center">
                            🥉 DISPUTA DE 3º LUGAR
                          </div>
                          <div className="flex flex-col justify-around">
                            {thirdPlaceMatches.map((m) => (
                              <div key={m.id} className="relative flex items-center">
                                {renderBracketNode(m, 'knockout_blue')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* PARTE INFERIOR: CHAVE DOS PERDEDORES / REPESCAGEM (VERMELHO SUAVE) */}
              {(losersR1.length > 0 || losersR2.length > 0) && (
                <div className="space-y-4 pt-6 border-t-2 border-dashed border-rose-500/35">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-rose-700/80 text-white border border-rose-500/40 font-black text-xs uppercase tracking-wider">
                      CHAVE DOS PERDEDORES / REPESCAGEM (BURACO · VERMELHO)
                    </span>
                    <span className="text-xs font-bold text-rose-300/90">
                      Quem vence sobrevive rumo à Semifinal · Quem perde a 2ª vez está eliminado
                    </span>
                  </div>

                  <div className="flex items-stretch gap-8 lg:gap-12">
                    {/* Repescagem Rodada 1 */}
                    {losersR1.length > 0 && (
                      <div className="flex flex-col justify-around space-y-5">
                        <div className="px-3 py-1.5 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-500/40 font-black text-xs uppercase tracking-wider text-center">
                          Repescagem 1ª Fase (Perdedores J1xJ2 e J3xJ4)
                        </div>
                        <div className="flex flex-col justify-around gap-6 flex-1">
                          {losersR1.map((m) => (
                            <div key={m.id} className="relative flex items-center">
                              {renderBracketNode(m, 'losers_red')}
                              <div className="hidden sm:flex items-center w-8 lg:w-12">
                                <div className="h-0.5 w-full bg-rose-500/50" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Repescagem Rodada 2 */}
                    {losersR2.length > 0 && (
                      <div className="flex flex-col justify-around space-y-5">
                        <div className="px-3 py-1.5 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-500/40 font-black text-xs uppercase tracking-wider text-center">
                          {semiFormat === 'semi_direta'
                            ? 'Repescagem 2ª Fase · Vale Vaga na Semifinal (J9 e J10)'
                            : 'Repescagem 2ª Fase · Cruzamento (J9 e J10)'}
                        </div>
                        <div className="flex flex-col justify-around gap-6 flex-1">
                          {losersR2.map((m) => (
                            <div key={m.id} className="relative flex items-center">
                              {renderBracketNode(m, 'losers_red')}
                              {semiFormat === 'semi_com_chance' && (
                                <div className="hidden sm:flex items-center w-8 lg:w-12">
                                  <div className="h-0.5 w-full bg-rose-500/50" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Repescagem R3 & R4 (se Semi com Chance) */}
                    {semiFormat === 'semi_com_chance' && losersR3.length > 0 && (
                      <div className="flex flex-col justify-around space-y-5">
                        <div className="px-3 py-1.5 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-500/40 font-black text-xs uppercase tracking-wider text-center">
                          Semifinal Perdedores (J12)
                        </div>
                        <div className="flex flex-col justify-around flex-1">
                          {losersR3.map((m) => (
                            <div key={m.id} className="relative flex items-center">
                              {renderBracketNode(m, 'losers_red')}
                              <div className="hidden sm:flex items-center w-8 lg:w-12">
                                <div className="h-0.5 w-full bg-rose-500/50" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {semiFormat === 'semi_com_chance' && losersR4.length > 0 && (
                      <div className="flex flex-col justify-around space-y-5">
                        <div className="px-3 py-1.5 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-500/40 font-black text-xs uppercase tracking-wider text-center">
                          Final Perdedores (J13)
                        </div>
                        <div className="flex flex-col justify-around flex-1">
                          {losersR4.map((m) => (
                            <div key={m.id} className="relative flex items-center">
                              {renderBracketNode(m, 'losers_red')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
