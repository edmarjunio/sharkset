import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BracketMatch } from '../types';
import { Eye, Radio, Video, Crown, CheckCircle2, MapPin, Play } from 'lucide-react';

interface MostWatchedGamesMiniRailProps {
  onSelectTournamentMatch?: (match: BracketMatch) => void;
  compact?: boolean;
}

export const MostWatchedGamesMiniRail: React.FC<MostWatchedGamesMiniRailProps> = ({
  onSelectTournamentMatch,
  compact = false,
}) => {
  const {
    tournamentMatches,
    tournaments,
    bookings,
    setActiveLiveBroadcastBookingId,
    setActiveTab,
    setActiveTournamentId,
    liveSpectatorsCount,
  } = useApp();

  // Build unified list of most-watched live games (Tournament Matches + Arena Booking Live Broadcasts)
  const miniGames = useMemo(() => {
    const items: {
      id: string;
      kind: 'tournament_match' | 'booking_broadcast';
      title: string;
      subtitle: string;
      team1Label: string;
      team2Label: string;
      score1: number;
      score2: number;
      spectators: number;
      courtLabel: string;
      refereeName: string;
      isRankingVerified: boolean;
      thumbnailUrl: string;
      rawMatch?: BracketMatch;
      bookingId?: string;
    }[] = [];

    // 1. Live Arena Booking Broadcasts
    bookings
      .filter((b) => b.status === 'confirmed' && b.liveBroadcast?.isLive)
      .forEach((b, idx) => {
        const parts = b.participants || [];
        const t1 = parts
          .filter((p) => p.teamSlot === 1)
          .map((p) => p.name.split(' ')[0])
          .join(' & ');
        const t2 = parts
          .filter((p) => p.teamSlot === 2)
          .map((p) => p.name.split(' ')[0])
          .join(' & ');
        const confirmed4 = parts.filter((p) => p.confirmedPresent).length === 4;

        items.push({
          id: `live-bk-${b.id}`,
          kind: 'booking_broadcast',
          title: b.liveBroadcast?.streamTitle || `Desafio na ${b.courtName}`,
          subtitle: `${b.arenaName || 'Arena'} · ${b.startTime}`,
          team1Label: t1 || b.customerName,
          team2Label: t2 || 'Convidados',
          score1: b.liveBroadcast?.score1 ?? 0,
          score2: b.liveBroadcast?.score2 ?? 0,
          spectators: (b.liveBroadcast?.spectatorsCount || 120) + (liveSpectatorsCount - 1),
          courtLabel: b.courtName,
          refereeName: b.referee?.name || b.customerName,
          isRankingVerified: confirmed4,
          thumbnailUrl:
            b.liveBroadcast?.thumbnailUrl ||
            (idx % 2 === 0
              ? 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=600&q=80'
              : 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=600&q=80'),
          bookingId: b.id,
        });
      });

    // 2. Live or Featured Tournament Matches
    tournamentMatches
      .filter((m) => m.team1 && m.team2 && (m.status === 'in_progress' || m.matchNumber <= 4))
      .slice(0, 4)
      .forEach((m, idx) => {
        const tourn = tournaments.find((t) => t.id === m.tournamentId);
        const baseSpec =
          m.spectatorsCount || (m.status === 'in_progress' ? 210 - idx * 35 : 88 - idx * 12);

        items.push({
          id: `live-tm-${m.id}`,
          kind: 'tournament_match',
          title: `${tourn?.name || 'Torneio Oficial'} · Jogo #${m.matchNumber}`,
          subtitle: m.stageName,
          team1Label: `${m.team1!.player1.split(' ')[0]} & ${m.team1!.player2.split(' ')[0]}`,
          team2Label: `${m.team2!.player1.split(' ')[0]} & ${m.team2!.player2.split(' ')[0]}`,
          score1: m.score1 ?? 0,
          score2: m.score2 ?? 0,
          spectators: baseSpec + (liveSpectatorsCount - 1),
          courtLabel: m.courtName || 'Quadra Central',
          refereeName: m.liveReferee?.refereeName || 'Árbitro Oficial',
          isRankingVerified: true,
          thumbnailUrl:
            idx % 2 === 0
              ? 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80'
              : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
          rawMatch: m,
        });
      });

    return items.sort((a, b) => b.spectators - a.spectators);
  }, [bookings, tournamentMatches, tournaments, liveSpectatorsCount]);

  const totalWatchingAllGames = useMemo(
    () => miniGames.reduce((acc, g) => acc + g.spectators, 0),
    [miniGames]
  );

  const handleOpenFirstUserBookingBroadcast = () => {
    const firstActive = bookings.find((b) => b.status === 'confirmed');
    if (firstActive) {
      setActiveLiveBroadcastBookingId(firstActive.id);
    } else {
      setActiveTab('scheduler');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-black uppercase">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Jogos Mais Assistidos Agora (Miniatura)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-extrabold">
            <Eye className="w-3.5 h-3.5 text-orange-500" />
            <strong className="font-black tabular-nums">{totalWatchingAllGames}</strong> jogadores acompanhando ao vivo
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenFirstUserBookingBroadcast}
          className="px-3.5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          Transmitir Meu Jogo Ao Vivo (Vale Ranking)
        </button>
      </div>

      {/* Horizontal Miniature Cards Rail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {miniGames.slice(0, compact ? 4 : 4).map((game) => (
          <div
            key={game.id}
            onClick={() => {
              if (game.kind === 'booking_broadcast' && game.bookingId) {
                setActiveLiveBroadcastBookingId(game.bookingId);
              } else if (game.rawMatch) {
                if (onSelectTournamentMatch) {
                  onSelectTournamentMatch(game.rawMatch);
                } else {
                  setActiveTournamentId(game.rawMatch.tournamentId);
                  setActiveTab('tournaments');
                }
              }
            }}
            className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-orange-400 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md flex flex-col justify-between"
          >
            {/* Miniature Video Preview Header */}
            <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
              <img
                src={game.thumbnailUrl}
                alt={game.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

              {/* Top Left: LIVE badge + Viewer Count */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  AO VIVO
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-xs text-white text-[10px] font-black flex items-center gap-1 border border-white/15 tabular-nums">
                  <Eye className="w-3 h-3 text-orange-400" />
                  {game.spectators} assistindo
                </span>
              </div>

              {/* Center Play Hover Affordance */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="w-9 h-9 rounded-full bg-orange-500/95 text-white flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </span>
              </div>

              {/* Bottom Miniature Score Overlay */}
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
                <div className="text-[11px] font-extrabold truncate max-w-[65%]">
                  {game.team1Label} <span className="text-orange-400">vs</span> {game.team2Label}
                </div>
                <div className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-white/20 text-xs font-black tabular-nums text-orange-300">
                  {game.score1} x {game.score2}
                </div>
              </div>
            </div>

            {/* Miniature Card Footer Info */}
            <div className="p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                <span className="truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                  {game.courtLabel}
                </span>
                {game.isRankingVerified && (
                  <span className="text-emerald-700 font-black flex items-center gap-0.5 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Vale Ranking
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span className="truncate flex items-center gap-1">
                  <Crown className="w-3 h-3 text-orange-500 shrink-0" />
                  Árbitro: <strong>{game.refereeName}</strong>
                </span>
                <span className="text-orange-600 font-extrabold group-hover:underline">
                  Assistir →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
