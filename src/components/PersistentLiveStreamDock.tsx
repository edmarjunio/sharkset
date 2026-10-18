import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HISTORICAL_LEGEND_VIDEOS, INITIAL_LIVE_CHAT } from '../data/initialData';
import { BracketMatch, HistoricalLegendVideo, LiveChatMessage } from '../types';
import {
  Radio,
  Tv,
  Users,
  MessageSquare,
  Maximize2,
  Minimize2,
  Trophy,
  Flame,
  Send,
  Film,
  Sparkles,
  Share2,
  Eye,
  ShieldAlert,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';

export const PersistentLiveStreamDock: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    matchesByTournament,
    tournaments,
    tenant,
  } = useApp();

  // Flatten all live matches across all tournaments and sort by spectatorsCount DESC
  const allLiveMatches = useMemo(() => {
    const list: Array<{ match: BracketMatch; tournamentName: string }> = [];
    Object.entries(matchesByTournament).forEach(([tournId, matches]) => {
      const tourn = tournaments.find((t) => t.id === tournId);
      matches.forEach((m) => {
        if (m.status === 'in_progress') {
          list.push({
            match: m,
            tournamentName: tourn?.name || 'Copa Shark Set',
          });
        }
      });
    });
    return list.sort(
      (a, b) => (b.match.spectatorsCount || 150) - (a.match.spectatorsCount || 150)
    );
  }, [matchesByTournament, tournaments]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    () => allLiveMatches[0]?.match.id || ''
  );
  const [selectedLegendVideo, setSelectedLegendVideo] = useState<HistoricalLegendVideo | null>(
    null
  );
  const [streamMode, setStreamMode] = useState<'live' | 'legends'>('live');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isTheaterExpanded, setIsTheaterExpanded] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Live Chat & Crowd Poll State
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(INITIAL_LIVE_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [chatAuthor, setChatAuthor] = useState('Atleta Convidado');
  const [votesTeam1, setVotesTeam1] = useState(64);
  const [votesTeam2, setVotesTeam2] = useState(36);
  const [hasVoted, setHasVoted] = useState<1 | 2 | null>(null);
  const [replayRequestedToast, setReplayRequestedToast] = useState<string | null>(null);

  const activeLiveEntry = useMemo(() => {
    return (
      allLiveMatches.find((item) => item.match.id === selectedMatchId) ||
      allLiveMatches[0] ||
      null
    );
  }, [allLiveMatches, selectedMatchId]);

  const activeLegend = selectedLegendVideo || HISTORICAL_LEGEND_VIDEOS[0];

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg: LiveChatMessage = {
      id: `chat-${Date.now()}`,
      matchId: activeLiveEntry?.match.id || 'global',
      authorName: chatAuthor.trim() || 'Torcedor Shark',
      authorCity: tenant.city,
      text: chatInput.trim(),
      createdAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setChatMessages((prev) => [newMsg, ...prev]);
    setChatInput('');
  };

  const handleQuickReaction = (emojiText: string) => {
    const newMsg: LiveChatMessage = {
      id: `chat-${Date.now()}`,
      matchId: activeLiveEntry?.match.id || 'global',
      authorName: chatAuthor.trim() || 'Torcedor Shark',
      authorCity: tenant.city,
      text: emojiText,
      createdAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      badge: 'torcedor',
    };
    setChatMessages((prev) => [newMsg, ...prev]);
  };

  const handleVote = (team: 1 | 2) => {
    if (hasVoted) return;
    setHasVoted(team);
    if (team === 1) setVotesTeam1((v) => v + 1);
    else setVotesTeam2((v) => v + 1);
  };

  const totalVotes = votesTeam1 + votesTeam2;
  const pct1 = Math.round((votesTeam1 / totalVotes) * 100);
  const pct2 = 100 - pct1;

  // When user is NOT on Home and hasn't expanded Theater mode, show a sleek Floating PiP Mini-Player
  // so the stream NEVER interrupts when visiting the Bracket ("Tabela"), Arenas, or Ranking!
  const showFloatingPiP = activeTab !== 'home' && !isTheaterExpanded;

  if (showFloatingPiP) {
    if (isMinimized) {
      return (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setIsMinimized(false)}
            className="px-4 py-2.5 rounded-2xl bg-slate-950 text-white border-2 border-amber-400 shadow-2xl flex items-center gap-2.5 cursor-pointer hover:bg-slate-900 transition-all"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-black text-amber-400">
              TV SHARK AO VIVO ({activeLiveEntry ? `${activeLiveEntry.match.score1 ?? 0}x${activeLiveEntry.match.score2 ?? 0}` : 'Lendas'})
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      );
    }

    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-slate-950 text-white rounded-2xl border-2 border-amber-400 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Top PiP Bar */}
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase animate-pulse">
              <Radio className="w-2.5 h-2.5" />
              PIP ININTERRUPTO
            </span>
            <span className="text-[11px] font-bold text-slate-200 truncate">
              {streamMode === 'live' && activeLiveEntry
                ? `Jogo ${activeLiveEntry.match.matchNumber} · ${activeLiveEntry.match.courtName || 'Quadra Central'}`
                : activeLegend.title}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsTheaterExpanded(true)}
              className="p-1 text-slate-300 hover:text-amber-400 rounded cursor-pointer"
              title="Expandir Transmissão + Chat"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
              title="Minimizar player"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Uninterrupted Video Feed Canvas */}
        <div className="relative h-44 bg-slate-900 overflow-hidden">
          <img
            src={
              streamMode === 'live'
                ? 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&auto=format&fit=crop&q=80'
                : activeLegend.thumbnailUrl
            }
            alt="Transmissão Ao Vivo"
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

          {/* Live Viewers & Audio Toggle */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-black/70 text-white font-bold flex items-center gap-1 backdrop-blur-xs">
              <Eye className="w-3 h-3 text-emerald-400" />
              {streamMode === 'live'
                ? `${activeLiveEntry?.match.spectatorsCount || 342} assistindo`
                : `${activeLegend.viewsCount} views`}
            </span>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black cursor-pointer"
              title={isMuted ? 'Ativar som' : 'Mutar'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          </div>

          {/* Scoreboard Overlay inside PiP */}
          {streamMode === 'live' && activeLiveEntry && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <div className="truncate pr-2">
                  <div className="font-extrabold text-white truncate">
                    {activeLiveEntry.match.team1?.player1} / {activeLiveEntry.match.team1?.player2}
                  </div>
                  <div className="font-extrabold text-slate-300 truncate">
                    {activeLiveEntry.match.team2?.player1} / {activeLiveEntry.match.team2?.player2}
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono font-black text-sm shrink-0">
                  {activeLiveEntry.match.score1 ?? 0} x {activeLiveEntry.match.score2 ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Navigation Switcher between Tabela and Full Stream */}
        <div className="p-2.5 bg-slate-950 flex items-center justify-between gap-2 text-[11px]">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-extrabold cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'tournaments'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-3 h-3" />
            Ver na Tabela
          </button>
          <button
            onClick={() => {
              setIsTheaterExpanded(false);
              setActiveTab('home');
            }}
            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black cursor-pointer flex items-center justify-center gap-1"
          >
            <Tv className="w-3 h-3" />
            Voltar p/ Transmissão
          </button>
        </div>
      </div>
    );
  }

  // Full Broadcast Hub (Rendered inside Home OR when Theater Modal is expanded)
  return (
    <div
      className={
        isTheaterExpanded
          ? 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center'
          : 'max-w-7xl mx-auto px-4 sm:px-6 pt-6'
      }
    >
      <div className="w-full max-w-7xl bg-slate-950 text-white border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Top Broadcast Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-black uppercase animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              SHARK SET TV · TRANSMISSÃO ININTERRUPTA
            </span>

            {/* Mode Switcher: Jogos Ao Vivo vs Arsenal de Lendas */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStreamMode('live')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  streamMode === 'live'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Jogos Ao Vivo ({allLiveMatches.length})
              </button>
              <button
                onClick={() => setStreamMode('legends')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  streamMode === 'legends'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                História & Lendas do Futevôlei ({HISTORICAL_LEGEND_VIDEOS.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Button to jump straight to the Bracket while keeping PiP active */}
            <button
              onClick={() => {
                setIsTheaterExpanded(false);
                setActiveTab('tournaments');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Trophy className="w-3.5 h-3.5" />
              Ir para a Tabela (Transmissão Continua em PiP)
            </button>

            {isTheaterExpanded && (
              <button
                onClick={() => setIsTheaterExpanded(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Fechar Tela Cheia ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Broadcast Grid: Left 8 Cols Video + Multi-Stream Selector, Right 4 Cols Real-Time Chat & Crowd Poll */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Video Stage + Stream Selector */}
          <div className="lg:col-span-8 p-4 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800">
            {/* Main Video Stage */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video group">
              <img
                src={
                  streamMode === 'live'
                    ? 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1400&auto=format&fit=crop&q=80'
                    : activeLegend.thumbnailUrl
                }
                alt="Quadra Central Ao Vivo"
                className="w-full h-full object-cover opacity-80 group-hover:scale-[1.01] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-black/40" />

              {/* Top Overlay: Viewers Count + Camera Label + Sponsor QR Badge */}
              <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    {streamMode === 'live' ? 'AO VIVO · CÂMERA CENTRAL 4K' : `ACERVO HISTÓRICO · ${activeLegend.year}`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-black/75 text-emerald-400 text-xs font-extrabold flex items-center gap-1.5 backdrop-blur-xs">
                    <Users className="w-3.5 h-3.5" />
                    {streamMode === 'live'
                      ? `${activeLiveEntry?.match.spectatorsCount || 342} espectadores simultâneos`
                      : `${activeLegend.viewsCount} visualizações`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setReplayRequestedToast(
                        '🎬 Replay dos últimos 15 segundos salvo! Clipe disponível para compartilhar no Instagram/WhatsApp.'
                      );
                      setTimeout(() => setReplayRequestedToast(null), 5000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Clipar Último Ponto (Replay)
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-lg bg-black/75 text-white hover:bg-black cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                  </button>
                </div>
              </div>

              {/* Replay Clipped Toast inside Video */}
              {replayRequestedToast && (
                <div className="absolute top-14 left-3 right-3 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between">
                  <span>{replayRequestedToast}</span>
                  <button onClick={() => setReplayRequestedToast(null)} className="font-bold cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* Bottom TV Scoreboard Bug (Placar de TV Oficial com Ordem de Saque e Cartões) */}
              {streamMode === 'live' && activeLiveEntry ? (
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-md shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-amber-400 font-extrabold uppercase">
                        <span>{activeLiveEntry.tournamentName}</span>
                        <span>·</span>
                        <span>Jogo {activeLiveEntry.match.matchNumber} ({activeLiveEntry.match.stageName})</span>
                        <span>·</span>
                        <span className="text-emerald-400">
                          🏐 Sacando:{' '}
                          {activeLiveEntry.match.liveReferee?.serviceOrderLabels?.[
                            activeLiveEntry.match.liveReferee.serverRotationIndex
                          ] || activeLiveEntry.match.team1?.player1}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm sm:text-base font-black text-white">
                            {activeLiveEntry.match.team1?.player1} & {activeLiveEntry.match.team1?.player2}
                          </span>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-mono font-black text-base sm:text-lg tabular-nums shadow-xs">
                          {activeLiveEntry.match.score1 ?? 0} x {activeLiveEntry.match.score2 ?? 0}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm sm:text-base font-black text-white">
                            {activeLiveEntry.match.team2?.player1} & {activeLiveEntry.match.team2?.player2}
                          </span>
                        </div>
                      </div>

                      {/* Discipline Cards & Timeouts Indicator */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 pt-0.5">
                        <span>
                          Tempos: {activeLiveEntry.match.liveReferee?.team1TimeoutsUsed ?? 0}/1 ·{' '}
                          {activeLiveEntry.match.liveReferee?.team2TimeoutsUsed ?? 0}/1
                        </span>
                        {activeLiveEntry.match.liveReferee?.cardsHistory &&
                          activeLiveEntry.match.liveReferee.cardsHistory.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                              🟨 Cartão: {activeLiveEntry.match.liveReferee.cardsHistory[0].playerName} (
                              {activeLiveEntry.match.liveReferee.cardsHistory[0].reason})
                            </span>
                          )}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('tournaments')}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold text-xs cursor-pointer shrink-0 flex items-center gap-1.5 border border-slate-700"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Ver Jogo na Tabela
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                    LENDAS DO FUTEVÔLEI · {activeLegend.legendName}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    {activeLegend.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">{activeLegend.description}</p>
                </div>
              )}
            </div>

            {/* Multi-Stream Carousel (Sorted by Most Spectators) OR Legends Selector */}
            {streamMode === 'live' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-amber-400 uppercase tracking-wider">
                    📡 Escolher Quadra / Transmissão Ao Vivo (Ordenado por Mais Espectadores)
                  </span>
                  <span className="text-slate-400">
                    Troque de câmera sem interromper o áudio
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allLiveMatches.map(({ match, tournamentName }, idx) => {
                    const isSelected = activeLiveEntry?.match.id === match.id;
                    return (
                      <button
                        key={match.id}
                        onClick={() => setSelectedMatchId(match.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-slate-900 border-amber-400 ring-1 ring-amber-400/40'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 uppercase">
                            <span>#{idx + 1} MAIS VISTO</span>
                            <span>·</span>
                            <span className="text-emerald-400">
                              {match.spectatorsCount || 210} assistindo
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-white truncate mt-0.5">
                            {match.team1?.player1}/{match.team1?.player2} vs {match.team2?.player1}/
                            {match.team2?.player2}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {tournamentName} · {match.courtName || 'Quadra Central'}
                          </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-mono font-black text-xs shrink-0">
                          {match.score1 ?? 0}x{match.score2 ?? 0}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-amber-400 uppercase tracking-wider">
                    🏆 Acervo Histórico: A História do Futevôlei & Seus Maiores Ídolos
                  </span>
                  <span className="text-slate-400">
                    Para assistir enquanto aguarda o próximo torneio ao vivo
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HISTORICAL_LEGEND_VIDEOS.map((vid) => {
                    const isSelected = activeLegend.id === vid.id;
                    return (
                      <button
                        key={vid.id}
                        onClick={() => setSelectedLegendVideo(vid)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-slate-900 border-amber-400 ring-1 ring-amber-400/40'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.legendName}
                          className="w-16 h-12 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black text-amber-400 uppercase truncate">
                            {vid.legendName} · {vid.duration}
                          </div>
                          <div className="text-xs font-extrabold text-white truncate">
                            {vid.title}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {vid.viewsCount} visualizações
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (4 Cols): Real-Time Spectator Chat + Interactive Crowd Poll */}
          <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between bg-slate-950 space-y-4">
            {/* Interactive Crowd Poll ("Palpite da Torcida Ao Vivo") */}
            {activeLiveEntry && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-amber-400 uppercase flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    Enquete Ao Vivo: Quem Vence?
                  </span>
                  <span className="text-slate-400 font-mono">{totalVotes} votos</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleVote(1)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-extrabold border text-left transition-all cursor-pointer ${
                      hasVoted === 1
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-white border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate">
                      {activeLiveEntry.match.team1?.player1} / {activeLiveEntry.match.team1?.player2}
                    </div>
                    <div className="font-mono text-[11px] opacity-85">{pct1}% da torcida</div>
                  </button>

                  <button
                    onClick={() => handleVote(2)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-extrabold border text-left transition-all cursor-pointer ${
                      hasVoted === 2
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-white border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate">
                      {activeLiveEntry.match.team2?.player1} / {activeLiveEntry.match.team2?.player2}
                    </div>
                    <div className="font-mono text-[11px] opacity-85">{pct2}% da torcida</div>
                  </button>
                </div>
              </div>
            )}

            {/* Live Chat Stream */}
            <div className="flex-1 flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 min-h-[260px] max-h-[340px]">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800 text-xs">
                <span className="font-black text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Chat da Transmissão Ao Vivo
                </span>
                <span className="text-[10px] font-mono text-emerald-400">● Online</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-2.5 space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-extrabold text-amber-400">
                        {msg.authorName}{' '}
                        {msg.authorCity && (
                          <span className="text-slate-400 font-normal">({msg.authorCity})</span>
                        )}
                      </span>
                      <span className="font-mono text-slate-500">{msg.createdAt}</span>
                    </div>
                    <p className="text-slate-200 text-xs leading-snug">{msg.text}</p>
                  </div>
                ))}
              </div>

              {/* 1-Click Crowd Reactions */}
              <div className="flex items-center gap-1.5 pt-2.5 pb-2">
                {['🦈 Shark Attack!', '🔥 Que ponto absurdo!', '🏐 Pingo monstro!', '👏 Jogo de Série A!'].map(
                  (reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => handleQuickReaction(reaction)}
                      className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      {reaction}
                    </button>
                  )
                )}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendChat} className="space-y-1.5 pt-1 border-t border-slate-800">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={chatAuthor}
                    onChange={(e) => setChatAuthor(e.target.value)}
                    placeholder="Seu nome"
                    className="w-28 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Comente ao vivo na transmissão..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
