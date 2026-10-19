import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { HISTORICAL_LEGEND_VIDEOS, INITIAL_LIVE_CHAT } from '../data/initialData';
import { BracketMatch, HistoricalLegendVideo, LiveChatMessage } from '../types';
import {
  X,
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
  Eye,
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
  const showFloatingPiP = activeTab !== 'home' && !isTheaterExpanded;

  useEffect(() => {
    if (activeTab === 'home') setIsMinimized(false);
  }, [activeTab]);

  useEffect(() => {
    if (!showFloatingPiP || isMinimized) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if ((event.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
      setIsMinimized(true);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [showFloatingPiP, isMinimized]);

  if (showFloatingPiP) {
    if (isMinimized) return null;

    const title = streamMode === 'live' && activeLiveEntry
      ? `Jogo ${activeLiveEntry.match.matchNumber} · ${activeLiveEntry.match.courtName || 'Quadra Central'}`
      : activeLegend.title;
    const expandPlayer = () => {
      setIsTheaterExpanded(false);
      setActiveTab('home');
    };

    return (
      <section className="shark-miniplayer" aria-label="Miniplayer da transmissão">
        <div className="shark-miniplayer-screen">
          <img
            src={streamMode === 'live'
              ? 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&auto=format&fit=crop&q=80'
              : activeLegend.thumbnailUrl}
            alt="Prévia da transmissão"
            className="broadcast-media w-full h-full object-cover"
          />
          <div className="shark-miniplayer-shade" />
          <div className="shark-miniplayer-top">
            <button type="button" onClick={expandPlayer} aria-label="Expandir transmissão"
              title="Expandir transmissão" className="shark-player-control">
              <Maximize2 size={20} />
            </button>
            <button type="button" onClick={() => setIsMinimized(true)} aria-label="Fechar miniplayer"
              title="Fechar (Esc)" className="shark-player-control">
              <X size={22} />
            </button>
          </div>
          {streamMode === 'live' && activeLiveEntry && (
            <div className="shark-miniplayer-score">
              <div className="min-w-0">
                <p className="truncate">{activeLiveEntry.match.team1?.player1} / {activeLiveEntry.match.team1?.player2}</p>
                <p className="truncate">{activeLiveEntry.match.team2?.player1} / {activeLiveEntry.match.team2?.player2}</p>
              </div>
              <strong className="shrink-0 tabular-nums">{activeLiveEntry.match.score1 ?? 0} × {activeLiveEntry.match.score2 ?? 0}</strong>
            </div>
          )}
          <div className="shark-miniplayer-bottom">
            <button type="button" disabled className="shark-player-control"
              aria-label="Áudio indisponível nesta prévia" title="Áudio indisponível nesta prévia">
              <VolumeX size={20} />
            </button>
            <span className="text-xs text-white/80">Prévia</span>
            <button type="button" onClick={expandPlayer} className="shark-player-control ml-auto"
              aria-label="Voltar à transmissão" title="Voltar à transmissão">
              <Tv size={20} />
            </button>
          </div>
        </div>
        <div className="shark-miniplayer-info">
          <button type="button" onClick={expandPlayer} className="min-w-0 flex-1 text-left"
            title={title}>
            <strong className="block truncate text-xs">{title}</strong>
            <span className="text-[11px] text-cyan-200/70">SHARKSET · Abrir transmissão</span>
          </button>
          {streamMode === 'live' && activeLiveEntry && (
            <button type="button" onClick={() => setActiveTab('tournaments')}
              className="shark-player-control" title="Ver tabela" aria-label="Ver tabela do campeonato">
              <Trophy size={18} />
            </button>
          )}
        </div>
      </section>
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
      <div className="aquarium-glass w-full max-w-7xl bg-[#030B17] text-white border-2 border-[#145A9B] rounded-3xl overflow-hidden shadow-xl">
        {/* Top Broadcast Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#071D3D] border-b border-[#145A9B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-black uppercase animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              SHARK SET TV · TRANSMISSÃO AO VIVO
            </span>

            {/* Mode Switcher: Jogos Ao Vivo vs Arsenal de Lendas */}
            <div className="flex items-center bg-[#030B17] p-1 rounded-xl border border-[#145A9B] text-xs">
              <button
                onClick={() => setStreamMode('live')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  streamMode === 'live'
                    ? 'bg-[#0987CE] text-white'
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
                    ? 'bg-[#0987CE] text-white'
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
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Trophy className="w-3.5 h-3.5" />
              Ir para a Tabela (Transmissão Continua em PiP)
            </button>

            {isTheaterExpanded && (
              <button
                onClick={() => setIsTheaterExpanded(false)}
                className="px-3 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-white font-bold text-xs cursor-pointer"
              >
                Fechar Tela Cheia ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Broadcast Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Video Stage + Stream Selector */}
          <div className="lg:col-span-8 p-4 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-[#145A9B]">
            {/* Main Video Stage */}
            <div className="aquarium-glass relative rounded-2xl overflow-hidden bg-[#071D3D] border border-[#145A9B] aspect-video group">
              <img
                src={
                  streamMode === 'live'
                    ? 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1400&auto=format&fit=crop&q=80'
                    : activeLegend.thumbnailUrl
                }
                alt="Quadra Central Ao Vivo"
                className="w-full h-full object-cover broadcast-media group-hover:scale-[1.01] transition-transform duration-500"
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#030B17]/25 via-transparent to-transparent" />

              {/* Top Overlay: Viewers Count + Camera Label */}
              <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    {streamMode === 'live' ? 'AO VIVO · CÂMERA CENTRAL 4K' : `ACERVO HISTÓRICO · ${activeLegend.year}`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#030B17]/85 text-[#12C7BB] text-xs font-extrabold flex items-center gap-1.5 backdrop-blur-xs border border-[#145A9B]">
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
                    className="px-3 py-1.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[11px] cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Clipar Último Ponto (Replay)
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-lg bg-[#030B17]/85 text-white hover:bg-[#071D3D] cursor-pointer border border-[#145A9B]"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#12C7BB]" />}
                  </button>
                </div>
              </div>

              {/* Replay Clipped Toast inside Video */}
              {replayRequestedToast && (
                <div className="absolute top-14 left-3 right-3 bg-[#12C7BB] text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between">
                  <span>{replayRequestedToast}</span>
                  <button onClick={() => setReplayRequestedToast(null)} className="font-bold cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* Bottom TV Scoreboard Bug */}
              {streamMode === 'live' && activeLiveEntry ? (
                <div className="absolute bottom-3 left-3 right-3 bg-[#030B17]/95 border border-[#145A9B] rounded-2xl p-3.5 backdrop-blur-md shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5BC3FA] font-extrabold uppercase">
                        <span>{activeLiveEntry.tournamentName}</span>
                        <span>·</span>
                        <span>Jogo {activeLiveEntry.match.matchNumber} ({activeLiveEntry.match.stageName})</span>
                        <span>·</span>
                        <span className="text-[#12C7BB]">
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
                        <span className="px-3 py-1 rounded-xl bg-[#0987CE] text-white font-mono font-black text-base sm:text-lg tabular-nums shadow-xs">
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
                          Juiz: <strong className="text-white">{activeLiveEntry.match.liveReferee?.refereeName || 'Oficial SHARK SET'}</strong> · Tempos: {activeLiveEntry.match.liveReferee?.team1TimeoutsUsed ?? 0}/1 ·{' '}
                          {activeLiveEntry.match.liveReferee?.team2TimeoutsUsed ?? 0}/1
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('tournaments')}
                      className="px-3.5 py-2 rounded-xl bg-[#071D3D] hover:bg-[#0B254E] text-[#12C7BB] font-extrabold text-xs cursor-pointer shrink-0 flex items-center gap-1.5 border border-[#145A9B]"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Ver Jogo na Tabela
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 right-3 bg-[#030B17]/95 border border-[#145A9B] rounded-2xl p-4 backdrop-blur-md">
                  <span className="px-2 py-0.5 rounded bg-[#0987CE] text-white font-black text-[10px] uppercase">
                    LENDAS DO FUTEVÔLEI · {activeLegend.legendName}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    {activeLegend.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">{activeLegend.description}</p>
                </div>
              )}
            </div>

            {/* Multi-Stream Carousel OR Legends Selector */}
            {streamMode === 'live' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#5BC3FA] uppercase tracking-wider">
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
                            ? 'bg-[#071D3D] border-[#0987CE] ring-1 ring-[#0987CE]/40'
                            : 'bg-[#071D3D]/50 border-[#145A9B] hover:border-[#0987CE]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-[#5BC3FA] uppercase">
                            <span>#{idx + 1} MAIS VISTO</span>
                            <span>·</span>
                            <span className="text-[#12C7BB]">
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
                        <div className="px-2.5 py-1 rounded-xl bg-[#0987CE] text-white font-mono font-black text-xs shrink-0">
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
                  <span className="font-black text-[#5BC3FA] uppercase tracking-wider">
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
                            ? 'bg-[#071D3D] border-[#0987CE] ring-1 ring-[#0987CE]/40'
                            : 'bg-[#071D3D]/50 border-[#145A9B] hover:border-[#0987CE]'
                        }`}
                      >
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.legendName}
                          className="w-16 h-12 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black text-[#12C7BB] uppercase truncate">
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
          <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between bg-[#030B17] space-y-4">
            {/* Interactive Crowd Poll */}
            {activeLiveEntry && (
              <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-[#12C7BB] uppercase flex items-center gap-1">
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
                        ? 'bg-[#0987CE] text-white border-[#0987CE]'
                        : 'bg-[#030B17] text-white border-[#145A9B] hover:border-[#0987CE]'
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
                        ? 'bg-[#0987CE] text-white border-[#0987CE]'
                        : 'bg-[#030B17] text-white border-[#145A9B] hover:border-[#0987CE]'
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
            <div className="flex-1 flex flex-col bg-[#071D3D]/80 border border-[#145A9B] rounded-2xl p-3.5 min-h-[260px] max-h-[340px]">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#145A9B]/60 text-xs">
                <span className="font-black text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0987CE]" />
                  Chat da Transmissão Ao Vivo
                </span>
                <span className="text-[10px] font-mono text-[#12C7BB]">● Online</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-[#030B17] border border-[#145A9B]/60 rounded-xl p-2.5 space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-extrabold text-[#5BC3FA]">
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
              <div className="flex items-center gap-1.5 pt-2.5 pb-2 overflow-x-auto">
                {['🦈 Shark Attack!', '🔥 Que ponto absurdo!', '🏐 Pingo monstro!', '👏 Jogo de Série A!'].map(
                  (reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => handleQuickReaction(reaction)}
                      className="px-2 py-1 rounded-lg bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[10px] font-bold text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      {reaction}
                    </button>
                  )
                )}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendChat} className="space-y-1.5 pt-2 border-t border-[#145A9B]/60">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={chatAuthor}
                    onChange={(e) => setChatAuthor(e.target.value)}
                    placeholder="Seu nome"
                    className="w-24 sm:w-28 px-2.5 py-1.5 rounded-xl bg-[#030B17] border border-[#145A9B] text-[11px] text-slate-200 focus:outline-none focus:border-[#0987CE]"
                  />
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Comente ao vivo..."
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[#030B17] border border-[#145A9B] text-xs text-white focus:outline-none focus:border-[#0987CE]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs cursor-pointer flex items-center justify-center shrink-0"
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

