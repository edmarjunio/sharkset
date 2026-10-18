import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BroadcastOverlay } from './BroadcastOverlay';
import { useApp } from '../context/AppContext';
import {
  AthleteLevel,
  Booking,
  BookingLiveChatMessage,
  BookingParticipant,
  PointSkillType,
  RefereePointEvent,
} from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import {
  X,
  Radio,
  Video,
  Camera,
  Users,
  ShieldCheck,
  Trophy,
  MessageSquare,
  Send,
  Plus,
  Minus,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Eye,
  Award,
  AlertCircle,
  Crown,
  MapPin,
  Clock,
  Play,
  Square,
} from 'lucide-react';

interface LiveBookingBroadcastModalProps {
  bookingId: string;
  onClose: () => void;
}

const SKILL_LABELS: Record<PointSkillType, { label: string; badge: string }> = {
  normal: { label: 'Rally Normal', badge: '🏐 Rally' },
  shark_attack: { label: 'Shark Attack', badge: '🦈 Shark Attack' },
  ace: { label: 'Ace de Saque', badge: '🎯 Ace' },
  pingo: { label: 'Pingo Curto', badge: '💧 Pingo' },
  erro_adv: { label: 'Erro Adversário', badge: '⚠️ Erro Adv.' },
};

export const LiveBookingBroadcastModal: React.FC<LiveBookingBroadcastModalProps> = ({
  bookingId,
  onClose,
}) => {
  const {
    bookings,
    athletes,
    userProfile,
    updateBookingMatchSetup,
    finishLiveBookingMatchAndCreditRanking,
    setActiveTab,
  } = useApp();

  const booking = useMemo(
    () => bookings.find((b) => b.id === bookingId) || bookings[0],
    [bookings, bookingId]
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string>(booking?.id || '');
  const activeBooking: Booking | undefined = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || booking,
    [bookings, selectedBookingId, booking]
  );

  // Camera WebRTC state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const [usingWebcam, setUsingWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const [selectedSkill, setSelectedSkill] = useState<PointSkillType>('normal');
  const [streamTitleInput, setStreamTitleInput] = useState<string>(
    activeBooking?.liveBroadcast?.streamTitle ||
      `Ao Vivo na ${activeBooking?.courtName || 'Arena'} — Placar`
  );
  const [chatInput, setChatInput] = useState('');
  const [chatRoleMode, setChatRoleMode] = useState<'referee_broadcaster' | 'player' | 'spectator'>(
    'referee_broadcaster'
  );
  const [rankingFeedback, setRankingFeedback] = useState<{
    credited: boolean;
    message: string;
  } | null>(null);

  useEffect(() => () => cameraStream.current?.getTracks().forEach(track => track.stop()), []);
  useEffect(() => {
    if (usingWebcam && videoRef.current) videoRef.current.srcObject = cameraStream.current;
  }, [usingWebcam]);



  // Ensure default 4 slots exist in UI editor
  const currentParticipants: BookingParticipant[] = useMemo(() => {
    const existing = activeBooking?.participants || [];
    const defaults: BookingParticipant[] = Array.from({ length: 4 }, (_, index) => existing[index] || {
      athleteId: '', name: 'Selecionar jogador', level: 'iniciante',
      teamSlot: index < 2 ? 1 : 2, confirmedPresent: false, invitedBy: activeBooking?.customerName || '',
    });
    return defaults;
  }, [activeBooking, athletes]);

  const confirmedCount = currentParticipants.filter((p) => p.confirmedPresent).length;
  const all4IdentifiedAndPresent = confirmedCount === 4;

  const team1Names = currentParticipants
    .filter((p) => p.teamSlot === 1)
    .map((p) => p.name)
    .join(' & ');
  const team2Names = currentParticipants
    .filter((p) => p.teamSlot === 2)
    .map((p) => p.name)
    .join(' & ');

  const liveState = activeBooking?.liveBroadcast || {
    isLive: false,
    streamTitle: streamTitleInput,
    videoUrl:
      'https://assets.mixkit.co/videos/preview/mixkit-men-playing-volleyball-on-the-beach-at-sunset-40246-large.mp4',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=900&q=80',
    spectatorsCount: 0,
    score1: 0,
    score2: 0,
    targetPoints: 18,
    servingTeam: 1 as 1 | 2,
    serverName: currentParticipants[0]?.name || 'Jogador 1',
    startedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    rankingPointsCredited: false,
    pointHistory: [],
    chatMessages: [],
  };

  // Check if current logged user is Owner, Invited Participant, or Invited Referee
  const isUserAuthorizedForBooking = useMemo(() => {
    if (!activeBooking) return '';
    const uName = userProfile.name.toLowerCase();
    if (activeBooking?.customerName.toLowerCase() === uName) return 'Titular do Agendamento';
    if (currentParticipants.some((p) => p.name.toLowerCase() === uName))
      return 'Convidado da Partida (Mesmo Horário)';
    if (activeBooking.referee?.name.toLowerCase() === uName) return 'Árbitro Convidado da Partida';
    return 'Convidado / Organizador na Arena';
  }, [activeBooking, currentParticipants, userProfile.name]);

  const handleSelectParticipant = (slotIdx: number, athleteId: string) => {
    const found = athletes.find((a) => a.id === athleteId);
    if (!found) return;
    const nextList = currentParticipants.map((item, idx) =>
      idx === slotIdx
        ? {
            ...item,
            athleteId: found.id,
            name: found.name,
            level: found.level,
            teamSlot: (slotIdx < 2 ? 1 : 2) as 1 | 2,
            confirmedPresent: true,
            invitedBy: activeBooking?.customerName,
          }
        : item
    );
    updateBookingMatchSetup(activeBooking.id, (prev) => ({
      ...prev,
      participants: nextList,
    }));
  };

  const handleToggleParticipantPresence = (slotIdx: number) => {
    const nextList = currentParticipants.map((item, idx) =>
      idx === slotIdx ? { ...item, confirmedPresent: !item.confirmedPresent } : item
    );
    updateBookingMatchSetup(activeBooking.id, (prev) => ({
      ...prev,
      participants: nextList,
    }));
  };

  const handleInviteReferee = (athleteId: string) => {
    if (!athleteId) {
      updateBookingMatchSetup(activeBooking.id, (prev) => ({ ...prev, referee: null }));
      return;
    }
    const found = athletes.find((a) => a.id === athleteId);
    if (!found) return;
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    updateBookingMatchSetup(activeBooking.id, (prev) => {
      const existingLive = prev.liveBroadcast || liveState;
      return {
        ...prev,
        participants: currentParticipants,
        referee: {
          athleteId: found.id,
          name: found.name,
          phone: found.phone,
          status: 'accepted',
          isBroadcastOwner: true,
        },
        liveBroadcast: {
          ...existingLive,
          chatMessages: [
            {
              id: `ref-msg-${Date.now()}`,
              author: found.name,
              role: 'referee_broadcaster',
              roleLabel: '👑 ÁRBITRO & DONO DA TRANSMISSÃO',
              text: `🎙️ ${found.name} assumiu a arbitragem e o comando da transmissão ao vivo! 4 jogadores identificados em quadra.`,
              timestamp: nowStr,
            },
            ...existingLive.chatMessages,
          ],
        },
      };
    });
  };

  const handleStartOrToggleLiveBroadcast = async (useCameraDevice: boolean) => {
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (useCameraDevice) {
      try {
        setWebcamError(null);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStream.current?.getTracks().forEach(track => track.stop());
        cameraStream.current = stream;
        setUsingWebcam(true);
      } catch {
        setWebcamError(
          'Não foi possível abrir a câmera. Confira a permissão no navegador.'
        );
        setUsingWebcam(false);
      }
      return; // A local preview does not publish video.
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
      setUsingWebcam(false);
    }

    updateBookingMatchSetup(activeBooking.id, (prev) => {
      const curr = prev.liveBroadcast || liveState;
      const nextIsLive = false;
      return {
        ...prev,
        participants: currentParticipants,
        liveBroadcast: {
          ...curr,
          isLive: nextIsLive,
          streamTitle:
            streamTitleInput.trim() || `Ao Vivo: ${team1Names} vs ${team2Names} (Placar)`,
          spectatorsCount: curr.spectatorsCount || 0,
          startedAt: curr.startedAt || nowStr,
          chatMessages: [
            {
              id: `start-live-${Date.now()}`,
              author: prev.referee?.name || userProfile.name,
              role: 'referee_broadcaster',
              roleLabel: '👑 ÁRBITRO & DONO DA TRANSMISSÃO',
              text: `🔴 TRANSMISSÃO AO VIVO NO AR! ${team1Names} vs ${team2Names} na ${prev.courtName}!`,
              timestamp: nowStr,
            },
            ...curr.chatMessages,
          ],
        },
      };
    });
  };

  const handleStopBroadcast = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setUsingWebcam(false);
    updateBookingMatchSetup(activeBooking.id, (prev) => {
      if (!prev.liveBroadcast) return prev;
      return {
        ...prev,
        liveBroadcast: {
          ...prev.liveBroadcast,
          isLive: false,
        },
      };
    });
  };

  const handleScorePoint = (team: 1 | 2, delta: 1 | -1) => {
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    updateBookingMatchSetup(activeBooking.id, (prev) => {
      const curr = prev.liveBroadcast || { ...liveState, isLive: true };
      const nextS1 = team === 1 ? Math.max(0, curr.score1 + delta) : curr.score1;
      const nextS2 = team === 2 ? Math.max(0, curr.score2 + delta) : curr.score2;

      const scorerLabel = team === 1 ? team1Names : team2Names;
      const newPointEvent: RefereePointEvent | null =
        delta > 0
          ? {
              id: `bpt-${Date.now()}`,
              timestamp: nowStr,
              scoringTeam: team,
              scorerName: scorerLabel,
              serverName: curr.serverName,
              skill: selectedSkill,
              scoreAfter: `${nextS1} x ${nextS2}`,
            }
          : null;

      return {
        ...prev,
        participants: currentParticipants,
        liveBroadcast: {
          ...curr,
          isLive: false,
          score1: nextS1,
          score2: nextS2,
          servingTeam: team,
          serverName:
            team === 1
              ? `${currentParticipants[0]?.name || 'Dupla 1'} (Dupla 1)`
              : `${currentParticipants[2]?.name || 'Dupla 2'} (Dupla 2)`,
          spectatorsCount: curr.spectatorsCount,
          pointHistory: newPointEvent
            ? [newPointEvent, ...(curr.pointHistory || [])].slice(0, 30)
            : curr.pointHistory,
        },
      };
    });
  };

  const handleSendChat = (customText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = (customText ?? chatInput).trim();
    if (!text) return;

    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isRefereeRole = chatRoleMode === 'referee_broadcaster';
    const authorName = isRefereeRole
      ? activeBooking.referee?.name || `${userProfile.name} (Árbitro/Transmissão)`
      : chatRoleMode === 'player'
      ? userProfile.name
      : 'Torcedor SHARKSET';

    const newMsg: BookingLiveChatMessage = {
      id: `chat-${Date.now()}`,
      author: authorName,
      role: chatRoleMode,
      roleLabel: isRefereeRole
        ? '👑 ÁRBITRO & DONO DA TRANSMISSÃO'
        : chatRoleMode === 'player'
        ? '⚽ JOGADOR DA PARTIDA'
        : '👀 ESPECTADOR AO VIVO',
      text,
      timestamp: nowStr,
    };

    updateBookingMatchSetup(activeBooking.id, (prev) => {
      const curr = prev.liveBroadcast || { ...liveState, isLive: true };
      return {
        ...prev,
        participants: currentParticipants,
        liveBroadcast: {
          ...curr,
          chatMessages: [newMsg, ...(curr.chatMessages || [])],
        },
      };
    });

    if (!customText) setChatInput('');
  };

  const handleFinishAndCreditRanking = (winningTeam: 1 | 2) => {
    // Ensure participants and liveBroadcast are saved first
    updateBookingMatchSetup(activeBooking.id, (prev) => ({
      ...prev,
      participants: currentParticipants,
      liveBroadcast: prev.liveBroadcast || { ...liveState, isLive: true },
    }));

    const res = finishLiveBookingMatchAndCreditRanking(activeBooking.id, winningTeam);
    setRankingFeedback(res);
  };

  if (!activeBooking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-6xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[95vh]">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-wider shadow-sm">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {liveState.isLive ? 'TRANSMISSÃO AO VIVO NO AR' : 'ESTÚDIO DE TRANSMISSÃO & ÁRBITRO'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-cyan-300 text-xs font-black border border-slate-700">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              {liveState.spectatorsCount} jogadores acompanhando agora
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Acesso: {isUserAuthorizedForBooking}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch between user's or invited bookings */}
            <select
              value={activeBooking.id}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                setRankingFeedback(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
            >
              {bookings
                .filter((b) => b.status === 'confirmed')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    📅 {b.startTime} · {b.courtName} ({b.customerName})
                  </option>
                ))}
            </select>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Fechar Estúdio Ao Vivo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
          {/* LEFT 7 COLUMNS: Live Video Player + Scoreboard + 4 Players Verification + Referee Invite */}
          <div className="lg:col-span-7 space-y-5">
            {/* Video Stream Container */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-900 shadow-lg aspect-video">
              {usingWebcam ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={liveState.videoUrl}
                  poster={liveState.thumbnailUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/60 pointer-events-none" />

              {/* Top Overlay: Live Status + Spectators Count + Arena/Court */}
              <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 shadow-md ${
                      liveState.isLive
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-900/90 text-slate-200 border border-white/15'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    {liveState.isLive ? 'AO VIVO' : 'PRONTO P/ TRANSMITIR'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-white text-xs font-black flex items-center gap-1.5 border border-white/15">
                    <Eye className="w-3.5 h-3.5 text-orange-400" />
                    {liveState.spectatorsCount} assistindo
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {all4IdentifiedAndPresent ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/95 text-slate-950 text-[11px] font-black uppercase flex items-center gap-1 shadow-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      4 jogadores identificados
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/90 text-slate-950 text-[11px] font-black uppercase">
                      Faltam {4 - confirmedCount} atletas p/ Ranking
                    </span>
                  )}
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3">
                <BroadcastOverlay state={liveState} team1={team1Names} team2={team2Names} />
              </div>
            </div>

            {webcamError && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-600 shrink-0" />
                <span>{webcamError}</span>
              </div>
            )}

            {/* Broadcast Camera & Title Controls */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-orange-500" />
                  Controle de Transmissão Ao Vivo Direto pelo Site
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartOrToggleLiveBroadcast(true)}
                    className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Prévia da câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartOrToggleLiveBroadcast(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Play className="w-3.5 h-3.5 text-orange-400" />
                    Transmitir Feed da Quadra
                  </button>
                  {liveState.isLive && (
                    <button
                      type="button"
                      onClick={handleStopBroadcast}
                      className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Pausar Live
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={streamTitleInput}
                  onChange={(e) => setStreamTitleInput(e.target.value)}
                  placeholder="Título da transmissão ao vivo..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateBookingMatchSetup(activeBooking.id, (prev) => ({
                      ...prev,
                      liveBroadcast: {
                        ...(prev.liveBroadcast || liveState),
                        streamTitle: streamTitleInput,
                      },
                    }))
                  }
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold cursor-pointer"
                >
                  Salvar Título
                </button>
              </div>
            </div>

            {/* STEP 1: 4 Identified Players in the Match (Prova Real for Ranking) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    1. Identificação dos 4 Jogadores da Partida (Prova Real p/ Ranking)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quem marcou a quadra ou foi convidado no mesmo horário pode convidar/confirmar os 4 atletas abaixo.
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${
                    all4IdentifiedAndPresent
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {confirmedCount}/4 Confirmados em Quadra
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentParticipants.map((part, idx) => {
                  const isTeam1 = idx < 2;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border ${
                        isTeam1
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-sky-50/60 border-sky-200'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-black uppercase">
                        <span className={isTeam1 ? 'text-emerald-800' : 'text-sky-800'}>
                          {isTeam1 ? `Dupla 1 · Atleta ${idx + 1}` : `Dupla 2 · Atleta ${idx - 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleParticipantPresence(idx)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer ${
                            part.confirmedPresent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {part.confirmedPresent ? '✓ Presente' : 'Confirmar Presença'}
                        </button>
                      </div>

                      <select
                        value={part.athleteId}
                        onChange={(e) => handleSelectParticipant(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                      >
                        {athletes.map((ath) => (
                          <option key={ath.id} value={ath.id}>
                            {ath.name} ({ATHLETE_LEVEL_LABELS[ath.level]} · {ath.points} pts)
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* STEP 2: Referee Invitation (Unlocked when 4 players are identified) */}
              <div
                className={`p-4 rounded-2xl border-2 transition-all ${
                  all4IdentifiedAndPresent
                    ? 'bg-orange-50/70 border-orange-300'
                    : 'bg-slate-100 border-slate-200 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-black uppercase tracking-wider text-orange-900 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-orange-600" />
                      2. Árbitro da Partida & Responsável pela Transmissão
                    </div>
                    <p className="text-xs text-slate-600">
                      {all4IdentifiedAndPresent
                        ? '4 jogadores confirmados! Convide qualquer jogador do site para ser o Árbitro Oficial (altera placar, comanda a live e tem comentário destacado).'
                        : 'Confirme a presença dos 4 jogadores acima para liberar o convite de Árbitro da partida.'}
                    </p>
                  </div>

                  <div className="sm:w-64 shrink-0">
                    <select
                      disabled={!all4IdentifiedAndPresent}
                      value={activeBooking.referee?.athleteId || ''}
                      onChange={(e) => handleInviteReferee(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-orange-300 text-xs font-black text-slate-900 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                    >
                      <option value="">Selecionar Árbitro no Site...</option>
                      {athletes.map((ath) => (
                        <option key={ath.id} value={ath.id}>
                          👑 Convidar {ath.name} ({ATHLETE_LEVEL_LABELS[ath.level]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: Referee Scoreboard Console + Ranking Proof Validation + Highlighted Live Chat */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <BroadcastOverlay state={liveState} team1={team1Names} team2={team2Names}
              onPoint={handleScorePoint}
              onChange={patch => updateBookingMatchSetup(activeBooking.id, previous => ({
                ...previous, liveBroadcast: { ...(previous.liveBroadcast || liveState), ...patch },
              }))} />
            {/* Referee Live Score & Ranking Validation Panel */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-orange-500" />
                    Placar do Árbitro & Prova Real Ranking
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Árbitro no comando:{' '}
                    <strong className="text-slate-900">
                      {activeBooking.referee?.name || `${userProfile.name} (Host)`}
                    </strong>
                  </p>
                </div>
                <span className="text-[11px] font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                  Set até {liveState.targetPoints} pts
                </span>
              </div>

              {/* Skill selector for point */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Fundamento do Ponto (vai para os stats dos atletas):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SKILL_LABELS) as PointSkillType[]).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSelectedSkill(sk)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                        selectedSkill === sk
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {SKILL_LABELS[sk].badge}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="text-xs font-black text-emerald-950 truncate">{team1Names}</div>
                  <div className="text-3xl font-black text-emerald-700 tabular-nums">
                    {liveState.score1}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleScorePoint(1, -1)}
                      className="p-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScorePoint(1, 1)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Ponto Dupla 1
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-center space-y-2">
                  <div className="text-xs font-black text-sky-950 truncate">{team2Names}</div>
                  <div className="text-3xl font-black text-sky-700 tabular-nums">
                    {liveState.score2}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleScorePoint(2, -1)}
                      className="p-2 rounded-xl bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScorePoint(2, 1)}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Ponto Dupla 2
                    </button>
                  </div>
                </div>
              </div>

              {/* Official Finish & Credit Ranking Stats Button */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-bold text-slate-600">
                  Finalizar partida transmitida ao vivo e creditar pontos reais no Ranking para os 4 jogadores:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!all4IdentifiedAndPresent || !!liveState.rankingPointsCredited}
                    onClick={() => handleFinishAndCreditRanking(1)}
                    className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer transition-all"
                  >
                    🏆 Vitória Dupla 1 (+Ranking)
                  </button>
                  <button
                    type="button"
                    disabled={!all4IdentifiedAndPresent || !!liveState.rankingPointsCredited}
                    onClick={() => handleFinishAndCreditRanking(2)}
                    className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer transition-all"
                  >
                    🏆 Vitória Dupla 2 (+Ranking)
                  </button>
                </div>

                {rankingFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
                      rankingFeedback.credited
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    <span>{rankingFeedback.message}</span>
                    {rankingFeedback.credited && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setActiveTab('ranking_athletes');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-black shrink-0 cursor-pointer"
                      >
                        Ver Ranking
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Live Chat with Highlighted Referee / Broadcast Owner Messages */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex-1 flex flex-col justify-between space-y-3 min-h-[340px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    Chat da Transmissão (Destaque do Árbitro)
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    {(liveState.chatMessages || []).length} comentários
                  </span>
                </div>

                {/* Role Switcher for Testing Highlighted Referee Comment */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setChatRoleMode('referee_broadcaster')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                      chatRoleMode === 'referee_broadcaster'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👑 Comentar como Árbitro/Dono
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatRoleMode('player')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                      chatRoleMode === 'player'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⚽ Jogador
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatRoleMode('spectator')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                      chatRoleMode === 'spectator'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👀 Espectador
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {(liveState.chatMessages || []).map((msg) => {
                  const isRefOwner = msg.role === 'referee_broadcaster';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-2xl text-xs transition-all ${
                        isRefOwner
                          ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-2 border-orange-400 shadow-sm ring-2 ring-orange-400/20'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900">{msg.author}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isRefOwner
                                ? 'bg-orange-500 text-white shadow-xs'
                                : msg.role === 'player'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {msg.roleLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{msg.timestamp}</span>
                      </div>
                      <p
                        className={`leading-relaxed ${
                          isRefOwner ? 'font-bold text-slate-950' : 'text-slate-700'
                        }`}
                      >
                        {msg.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Quick Referee Highlights + Chat Input */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '🎙️ Ponto confirmado na linha pelo Árbitro!',
                    '⚡ 4 Atletas em quadra — Jogo valendo Ranking!',
                    '🔥 Ponto de Shark Attack monstro!',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSendChat(preset)}
                      className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-bold cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <form onSubmit={(e) => handleSendChat(undefined, e)} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      chatRoleMode === 'referee_broadcaster'
                        ? 'Comentar com destaque de Árbitro / Dono da Transmissão...'
                        : 'Enviar mensagem no chat ao vivo...'
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
