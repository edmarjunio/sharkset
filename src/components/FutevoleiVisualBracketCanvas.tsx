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
  Move,
  ArrowRight,
  CornerDownRight,
  Radio,
  Share2,
  Swords,
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
  onCallMatchCourt?: (match: BracketMatch) => void;
  onShareMatch?: (match: BracketMatch) => void;
  onHistoryMatch?: (match: BracketMatch) => void;
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
  onCallMatchCourt,
  onShareMatch,
  onHistoryMatch,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [startY, setStartY] = useState<number>(0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const winnersR1 = matches.filter((m) => m.stage === 'winners' && m.round === 1);
  const winnersR2 = matches.filter((m) => m.stage === 'winners' && m.round === 2);
  const winnersR3 = matches.filter((m) => m.stage === 'winners' && m.round === 3);

  const losersR1 = matches.filter((m) => m.stage === 'losers' && m.round === 1);
  const losersR2 = matches.filter((m) => m.stage === 'losers' && m.round === 2);
  const losersR3 = matches.filter((m) => m.stage === 'losers' && m.round === 3);
  const losersR4 = matches.filter((m) => m.stage === 'losers' && m.round === 4);

  const semiMatches = matches.filter((m) => m.stage === 'semifinals');
  const finalMatches = matches.filter((m) => m.stage === 'grand_final');

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

  // Mobile Touch Pan & Pinch-to-Zoom
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

  // Wheel Zoom support (e.g. trackpad or Ctrl + Wheel)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((z) => Math.min(1.4, Math.max(0.45, Number((z + delta).toFixed(2)))));
    }
  };

  // Fit to screen helper (especially on mobile devices)
  const handleFitToScreen = () => {
    if (!scrollContainerRef.current) return;
    const containerWidth = scrollContainerRef.current.clientWidth;
    // Estimated width of full bracket tree is ~1350px
    const idealZoom = Math.min(1, Math.max(0.5, Number((containerWidth / 1380).toFixed(2))));
    setZoom(idealZoom);
    scrollContainerRef.current.scrollLeft = 0;
    scrollContainerRef.current.scrollTop = 0;
  };

  const getMatchNumberById = (matchId?: string) => {
    if (!matchId) return null;
    const found = matches.find((m) => m.id === matchId);
    return found ? found.matchNumber : null;
  };

  const renderBracketNode = (match: BracketMatch, accentColor: 'emerald' | 'amber' | 'indigo') => {
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

    const borderClass = isLive
      ? 'border-[#0987CE] ring-2 ring-[#0987CE]/50 bg-[#071D3D]'
      : accentColor === 'emerald'
      ? 'border-[#145A9B] hover:border-[#12C7BB] bg-[#071D3D]'
      : accentColor === 'amber'
      ? 'border-[#145A9B] hover:border-[#0987CE] bg-[#071D3D]'
      : 'border-[#145A9B] hover:border-[#0987CE] bg-[#071D3D]';

    const headerBgClass = isLive
      ? 'bg-[#030B17] text-[#12C7BB]'
      : accentColor === 'emerald'
      ? 'bg-[#030B17] text-white'
      : accentColor === 'amber'
      ? 'bg-[#030B17] text-slate-200'
      : 'bg-[#030B17] text-[#0987CE]';

    return (
      <div
        key={match.id}
        data-match-id={match.id}
        data-winner-id={match.winnerId || ''}
        className={`bracket-match-node relative w-[290px] sm:w-[310px] rounded-2xl border-2 shadow-sm transition-all shrink-0 ${borderClass}`}
      >
        {/* Top Match Number & Quick Referee / Edit Header */}
        <div className={`px-3 py-2 rounded-t-xl flex items-center justify-between text-[11px] ${headerBgClass}`}>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#0987CE] text-white font-black uppercase text-[10px]">
              JOGO {match.matchNumber}
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase animate-pulse">
                <Radio className="w-2.5 h-2.5" />
                AO VIVO
              </span>
            )}
            <span className="font-mono text-[10px] opacity-80 truncate max-w-[85px]">
              {match.courtName?.split(' - ')[0] || 'Quadra 1'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onShareMatch && (
              <button
                type="button"
                onClick={() => onShareMatch(match)}
                className="p-1 text-sky-300 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                title="Compartilhar deep link deste jogo"
              >
                <Share2 className="w-3 h-3" />
              </button>
            )}
            {onHistoryMatch && isReady && (
              <button
                type="button"
                onClick={() => onHistoryMatch(match)}
                className="p-1 text-[#12C7BB] hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                title="Ver histórico H2H e Votação de MVP da partida"
              >
                <Swords className="w-3 h-3" />
              </button>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => onOpenRefereeModal(match.id)}
                className="px-2 py-0.5 rounded bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[10px] flex items-center gap-0.5 cursor-pointer shadow-xs"
                title="Abrir Súmula do Árbitro (Saque, Tempo, Cartão)"
              >
                <ShieldAlert className="w-2.5 h-2.5" />
                Árbitro
              </button>
            )}
            {onCallMatchCourt && isReady && !isCompleted && (
              <button
                type="button"
                onClick={() => onCallMatchCourt(match)}
                className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-[10px] flex items-center gap-0.5 cursor-pointer shadow-xs transition-colors"
                title="Chamar jogadores pra quadra (Dispara alerta em tempo real no Firestore)"
              >
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Chamar
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

        {/* Live Service / Cards Mini Strip */}
        {match.liveReferee && !isCompleted && isReady && (
          <div className="px-3 py-1 bg-[#030B17] text-[10px] text-[#12C7BB] font-bold flex items-center justify-between border-b border-[#145A9B]">
            <span className="truncate">🏐 Saque: {currentServer || '1º Sacador'}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {yellowCardsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[#0987CE] text-white font-black text-[9px]">
                  📋 {yellowCardsCount}
                </span>
              )}
              <span className="text-slate-300 font-mono">
                T: {match.liveReferee.team1TimeoutsUsed}/{match.liveReferee.team2TimeoutsUsed}
              </span>
            </div>
          </div>
        )}

        {/* Match Participants & Inline Score Form */}
        <form onSubmit={(e) => onInlineSubmit(match, e)} className="p-2.5 space-y-1.5">
          {/* Slot 1 */}
          <div
            data-slot-winner={team1Won ? 'true' : 'false'}
            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition-colors ${
              team1Won
                ? 'bg-[#0987CE]/25 border-[#12C7BB] font-black text-white'
                : 'bg-[#030B17] border-[#145A9B]/60 text-slate-200'
            }`}
          >
            <div
              onClick={() => onOpenMatchEditor(match)}
              className="flex items-center gap-1.5 truncate pr-2 flex-1 cursor-pointer"
              title="Clique para trocar ou posicionar dupla manualmente"
            >
              <span className="px-1.5 py-0.5 rounded bg-[#071D3D] text-[#0987CE] font-mono font-bold text-[10px] shrink-0 border border-[#145A9B]">
                {match.team1 ? `#${match.team1.seed}` : 'A1'}
              </span>
              <span className="truncate font-bold">
                {match.team1 ? formatParticipantName(match.team1) : 'Aguardando Dupla...'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
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
                ? 'bg-[#0987CE]/25 border-[#12C7BB] font-black text-white'
                : 'bg-[#030B17] border-[#145A9B]/60 text-slate-200'
            }`}
          >
            <div
              onClick={() => onOpenMatchEditor(match)}
              className="flex items-center gap-1.5 truncate pr-2 flex-1 cursor-pointer"
              title="Clique para trocar ou posicionar dupla manualmente"
            >
              <span className="px-1.5 py-0.5 rounded bg-[#071D3D] text-[#0987CE] font-mono font-bold text-[10px] shrink-0 border border-[#145A9B]">
                {match.team2 ? `#${match.team2.seed}` : 'B1'}
              </span>
              <span className="truncate font-bold">
                {match.team2 ? formatParticipantName(match.team2) : 'Aguardando Dupla...'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
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

          {/* Footer: Visual Routing Destinations + Votar MVP + Confirm Button */}
          <div className="pt-1 flex items-center justify-between gap-1 text-[10px]">
            <div className="flex flex-wrap items-center gap-1 text-slate-400 font-semibold truncate">
              {nextWinNum && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#0987CE]/20 text-[#5BC3FA] border border-[#0987CE]/40 font-bold">
                  <ArrowRight className="w-2.5 h-2.5" />
                  Venc: J{nextWinNum}
                </span>
              )}
              {nextLoseNum ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#071D3D] text-slate-300 border border-[#145A9B] font-bold">
                  <CornerDownRight className="w-2.5 h-2.5" />
                  Perd: Rep. J{nextLoseNum}
                </span>
              ) : match.stage === 'losers' || match.stage === 'semifinals' ? (
                <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30 font-bold">
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
                  title="Votar no MVP (Craque da Partida) e ver histórico no Firestore"
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
    <div className="bg-[#030B17] border-2 border-[#145A9B] rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Infinity-Scroll Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#071D3D] text-[#F7FAFD] border-b border-[#145A9B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black text-[11px] uppercase shadow-xs">
            CHAVEAMENTO OFICIAL DE FUTEVÔLEI (PAN & ZOOM)
          </span>
          <span className="text-xs text-slate-300 hidden md:inline flex items-center gap-1">
            <Move className="w-3.5 h-3.5 inline text-[#12C7BB] mr-1" />
            Arraste para navegar livremente ou use pinça no celular — a tabela se adapta automaticamente a qualquer quantidade de {isSingles ? 'jogadores' : 'duplas'}.
          </span>
        </div>

        {/* Zoom & Pan Interactivity Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#030B17] p-1.5 rounded-xl border border-[#145A9B] text-xs">
          <button
            type="button"
            onClick={handleFitToScreen}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-[11px] cursor-pointer flex items-center gap-1 shadow-xs transition-all"
            title="Ajustar automaticamente toda a chave à tela do celular ou monitor"
          >
            <Maximize2 className="w-3 h-3" />
            Ajustar à Tela
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-[#071D3D] text-slate-300 hover:text-white cursor-pointer"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          
          <span className="px-2 font-mono font-black text-[#12C7BB] min-w-[48px] text-center">
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

          <div className="hidden sm:flex items-center gap-1 border-l border-[#145A9B] pl-1">
            <button
              type="button"
              onClick={() => setZoom(0.6)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                zoom === 0.6 ? 'bg-[#0987CE] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              60%
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.8)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                zoom === 0.8 ? 'bg-[#0987CE] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              80%
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                zoom === 1 ? 'bg-[#0987CE] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Touch Pan / Mobile Zoom Navigation Helper Strip */}
      <div className="bg-[#030B17] border-x border-b border-[#145A9B]/60 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5">
          <Move className="w-3 h-3 text-[#0987CE]" />
          <span>
            <strong>Dica de Navegação:</strong> Arraste com o dedo ou mouse para navegar na chave · Faça pinça para zoom no celular
          </span>
        </span>
        <span className="hidden md:inline font-mono text-[10px] text-slate-400">
          Scroll Livre 2D (Horizontal & Vertical)
        </span>
      </div>

      {/* Horizontal & Vertical Infinity Scroll Viewport with Full Pan and Zoom Touch Interactivity */}
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
        className={`overflow-x-auto overflow-y-auto max-h-[82vh] p-6 sm:p-8 bg-[#040E1C] select-none touch-pan-x touch-pan-y ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Dynamic Width Inner Canvas that scales with number of rounds & teams */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          className="min-w-max space-y-10 pb-8 pr-12 transition-transform duration-150"
        >
          {/* ================================================================= */}
          {/* PARTE SUPERIOR: CHAVE PRINCIPAL (VENCEDORES) + FASE FINAL         */}
          {/* ================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-emerald-600/30 pb-2">
              <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs uppercase tracking-wider">
                CHAVE PRINCIPAL (VENCEDORES · INVICTOS)
              </span>
              <span className="text-xs font-bold text-slate-600">
                Quem vence avança na chave principal · Quem perde 1x cai para a Repescagem abaixo
              </span>
            </div>

            <div className="flex items-stretch gap-8 lg:gap-12">
              {/* Coluna 1: 1ª Fase / Quartas (Jogos 1 a 4) */}
              <div className="flex flex-col justify-around space-y-5">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider text-center">
                  1ª Rodada · Chave Principal ({winnersR1.length} Jogos)
                </div>
                <div className="flex flex-col justify-around gap-6 flex-1">
                  {winnersR1.map((m) => (
                    <div key={m.id} className="relative flex items-center">
                      {renderBracketNode(m, 'emerald')}
                      {/* Visual Horizontal Bracket Line to Next Round */}
                      <div className="hidden sm:flex items-center w-8 lg:w-12">
                        <div className="h-0.5 w-full bg-emerald-500/70" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna 2: 2ª Fase Vencedores (Jogos 7 e 8 - Vale Vaga na Semi) */}
              {winnersR2.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-black text-xs uppercase tracking-wider text-center">
                    {semiFormat === 'semi_direta'
                      ? '2ª Rodada · Vale Vaga na Semifinal (J7 e J8)'
                      : '2ª Rodada · Semifinal Vencedores (J7 e J8)'}
                  </div>
                  <div className="flex flex-col justify-around gap-12 flex-1">
                    {winnersR2.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'emerald')}
                        <div className="hidden sm:flex items-center w-8 lg:w-12">
                          <div className="h-0.5 w-full bg-emerald-500/70" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coluna 3 (Opcional Challonge): Final Vencedores */}
              {semiFormat === 'semi_com_chance' && winnersR3.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#12C7BB] font-black text-xs uppercase tracking-wider text-center border border-[#145A9B]">
                    Final dos Vencedores (J11)
                  </div>
                  <div className="flex flex-col justify-around flex-1">
                    {winnersR3.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'emerald')}
                        <div className="hidden sm:flex items-center w-8 lg:w-12">
                          <div className="h-0.5 w-full bg-[#0987CE]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coluna Semifinais Diretas (Padrão Futevôlei: 1º Vencedor vs Vencedor Repescagem) */}
              {semiFormat === 'semi_direta' && semiMatches.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#0987CE] font-black text-xs uppercase tracking-wider text-center border border-[#0987CE]/50">
                    ⚡ Semifinais Cruzadas (Invicto vs Repescagem)
                  </div>
                  <div className="flex flex-col justify-around gap-12 flex-1">
                    {semiMatches.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'indigo')}
                        <div className="hidden sm:flex items-center w-8 lg:w-12">
                          <div className="h-0.5 w-full bg-[#0987CE]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coluna Grande Final */}
              {finalMatches.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] text-slate-950 font-black text-xs uppercase tracking-wider text-center shadow-md">
                    🏆 GRANDE FINAL DO TORNEIO
                  </div>
                  <div className="flex flex-col justify-around flex-1">
                    {finalMatches.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'indigo')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* PARTE INFERIOR: REPESCAGEM / CHAVE DOS PERDEDORES ("BURACO")      */}
          {/* ================================================================= */}
          <div className="space-y-4 pt-6 border-t-2 border-dashed border-[#145A9B]">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-[#071D3D] text-[#12C7BB] border border-[#145A9B] font-black text-xs uppercase tracking-wider">
                CHAVE DE REPESCAGEM / PERDEDORES (BURACO)
              </span>
              <span className="text-xs font-bold text-slate-400">
                Cruzamento oficial da tabela de Futevôlei: quem vence sobrevive rumo à Semifinal · quem perde a 2ª vez é eliminado
              </span>
            </div>

            <div className="flex items-stretch gap-8 lg:gap-12">
              {/* Repescagem Rodada 1 (Jogos 5 e 6) */}
              <div className="flex flex-col justify-around space-y-5">
                <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-white border border-[#145A9B] font-black text-xs uppercase tracking-wider text-center">
                  Repescagem 1ª Fase (Perdedores J1xJ2 e J3xJ4)
                </div>
                <div className="flex flex-col justify-around gap-6 flex-1">
                  {losersR1.map((m) => (
                    <div key={m.id} className="relative flex items-center">
                      {renderBracketNode(m, 'amber')}
                      <div className="hidden sm:flex items-center w-8 lg:w-12">
                        <div className="h-0.5 w-full bg-[#145A9B]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repescagem Rodada 2 (Jogos 9 e 10 - Cruzamento com Perdedores de J7/J8) */}
              {losersR2.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#0987CE] border border-[#145A9B] font-black text-xs uppercase tracking-wider text-center">
                    {semiFormat === 'semi_direta'
                      ? 'Repescagem 2ª Fase · Vale Vaga na Semifinal (J9 e J10)'
                      : 'Repescagem 2ª Fase · Cruzamento (J9 e J10)'}
                  </div>
                  <div className="flex flex-col justify-around gap-6 flex-1">
                    {losersR2.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'amber')}
                        {semiFormat === 'semi_com_chance' && (
                          <div className="hidden sm:flex items-center w-8 lg:w-12">
                            <div className="h-0.5 w-full bg-[#145A9B]" />
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
                  <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#12C7BB] border border-[#145A9B] font-black text-xs uppercase tracking-wider text-center">
                    Semifinal Repescagem (J12)
                  </div>
                  <div className="flex flex-col justify-around flex-1">
                    {losersR3.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'amber')}
                        <div className="hidden sm:flex items-center w-8 lg:w-12">
                          <div className="h-0.5 w-full bg-[#145A9B]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {semiFormat === 'semi_com_chance' && losersR4.length > 0 && (
                <div className="flex flex-col justify-around space-y-5">
                  <div className="px-3 py-1.5 rounded-xl bg-[#071D3D] text-[#12C7BB] border border-[#145A9B] font-black text-xs uppercase tracking-wider text-center">
                    Final Repescagem (J13)
                  </div>
                  <div className="flex flex-col justify-around flex-1">
                    {losersR4.map((m) => (
                      <div key={m.id} className="relative flex items-center">
                        {renderBracketNode(m, 'amber')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
