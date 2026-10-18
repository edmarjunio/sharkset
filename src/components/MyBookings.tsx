import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AthleteAchievement, AthleteGameStats, AthleteLevel, ExperienceCategory } from '../types';
import { generateBookingWhatsAppLink, generateWaitlistWhatsAppLink } from '../services/whatsappAdapter';
import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_LEVEL_WEIGHT,
  ATHLETE_TIERS,
  getRankingPromotionSuggestion,
  validatePairCategory,
} from '../services/rankingValidator';
import { AthleteLevelBadge } from './AthleteLevelBadge';
import {
  Calendar,
  Clock,
  MessageSquare,
  Trash2,
  Plus,
  Star,
  Activity,
  ArrowRight,
  ShieldCheck,
  Award,
  CheckCircle2,
  XCircle,
  BellRing,
  UserCheck,
  Upload,
  Video,
  Image as ImageIcon,
  Trophy,
  Edit3,
  Zap,
  Target,
} from 'lucide-react';

export const MyBookings: React.FC = () => {
  const {
    tenant,
    setTenantId,
    bookings,
    cancelBooking,
    waitlist,
    waitlistNotifications,
    leaveWaitlist,
    claimWaitlistSlot,
    dismissWaitlistNotification,
    setActiveTab,
    setArenaSubTab,
    userProfile,
    setUserProfile,
    classStudents,
    registeredPairs,
    athletes,
    changeAthleteLevel,
    updateAthleteProfile,
    updateAthleteGameStats,
    addAthleteMedia,
    removeAthleteMedia,
    addAthleteAchievement,
    removeAthleteAchievement,
  } = useApp();

  const [cancelToast, setCancelToast] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);

  // Media Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaTag, setMediaTag] = useState('Shark Attack');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [mediaUrlInput, setMediaUrlInput] = useState('');

  // New Achievement state
  const [achTitle, setAchTitle] = useState('');
  const [achTourn, setAchTourn] = useState('');
  const [achYear, setAchYear] = useState('2026');
  const [achPlacement, setAchPlacement] = useState<AthleteAchievement['placement']>('1º Lugar');

  const sportLabels: Record<string, string> = {
    futevolei: '⚽ Futevôlei',
    beach_tennis: '🎾 Beach Tennis',
    volei_praia: '🏐 Vôlei de Praia',
  };

  // Client's athlete ranking record
  const myAthleteProfile = useMemo(() => {
    return (
      athletes.find((a) => a.name.toLowerCase() === userProfile.name.toLowerCase()) ||
      athletes[0]
    );
  }, [athletes, userProfile.name]);

  const [bioInput, setBioInput] = useState(myAthleteProfile?.bio || '');

  // Calculate age from birthDate
  const athleteAge = useMemo(() => {
    if (!myAthleteProfile?.birthDate) return null;
    const birth = new Date(myAthleteProfile.birthDate);
    if (isNaN(birth.getTime())) return null;
    const diff = Date.now() - birth.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }, [myAthleteProfile?.birthDate]);

  // Game stats & Aproveitamento (%)
  const gameStats: AthleteGameStats = myAthleteProfile?.stats || {
    aces: 28,
    errors: 10,
    sharkAttacks: 16,
    pingoPoints: 42,
    defenses: 65,
  };

  const winRatePercent = useMemo(() => {
    if (!myAthleteProfile || myAthleteProfile.matchesPlayed === 0) return 0;
    return Math.round((myAthleteProfile.wins / myAthleteProfile.matchesPlayed) * 100);
  }, [myAthleteProfile]);

  const technicalEfficiencyPercent = useMemo(() => {
    const positiveActions =
      gameStats.aces + gameStats.sharkAttacks + gameStats.pingoPoints + gameStats.defenses;
    const totalActions = positiveActions + gameStats.errors;
    if (totalActions === 0) return 100;
    return Math.round((positiveActions / totalActions) * 100);
  }, [gameStats]);

  const promoStatus = useMemo(() => {
    return getRankingPromotionSuggestion(
      myAthleteProfile.points,
      myAthleteProfile.titlesCount,
      myAthleteProfile.level
    );
  }, [myAthleteProfile]);

  // Compute favorite courts ("quadras que mais joga")
  const favoriteCourts = useMemo(() => {
    const counts: Record<
      string,
      { courtId: string; courtName: string; tenantId: string; arenaName: string; count: number }
    > = {};
    bookings
      .filter((b) => b.status === 'confirmed')
      .forEach((b) => {
        if (!counts[b.courtId]) {
          counts[b.courtId] = {
            courtId: b.courtId,
            courtName: b.courtName,
            tenantId: b.tenantId,
            arenaName: b.arenaName || tenant.name,
            count: 0,
          };
        }
        counts[b.courtId].count += 1;
      });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [bookings, tenant.name]);

  // Client's enrolled classes
  const myClasses = useMemo(() => {
    return classStudents.filter((s) =>
      s.studentName.toLowerCase().includes(userProfile.name.split(' ')[0].toLowerCase())
    );
  }, [classStudents, userProfile.name]);

  // Client's tournament registrations
  const myTournPairs = useMemo(() => {
    const first = userProfile.name.split(' ')[0].toLowerCase();
    return registeredPairs.filter(
      (p) => p.player1.toLowerCase().includes(first) || p.player2.toLowerCase().includes(first)
    );
  }, [registeredPairs, userProfile.name]);

  // Active Waitlist entries
  const activeWaitlistEntries = useMemo(() => {
    return waitlist.filter((w) => w.status === 'waiting' || w.status === 'notified');
  }, [waitlist]);

  const triggerToast = (msg: string) => {
    setCancelToast(msg);
    setTimeout(() => setCancelToast(null), 4500);
  };

  const handleCancel = (id: string, courtName: string, time: string) => {
    const notifiedNext = cancelBooking(id);
    if (notifiedNext) {
      triggerToast(
        `🔔 Reserva na ${courtName} (${time}) cancelada! O 1º da Lista de Espera (${notifiedNext.customerName}) foi notificado automaticamente!`
      );
    } else {
      triggerToast(`Reserva na ${courtName} às ${time} cancelada.`);
    }
  };

  const handleLevelSwitch = (newLevel: AthleteLevel) => {
    setUserProfile({ ...userProfile, level: newLevel });
    changeAthleteLevel(myAthleteProfile.id, newLevel);
    triggerToast(`Badge de nível do perfil atualizado para ${ATHLETE_LEVEL_LABELS[newLevel]}!`);
  };

  const handleAdjustStat = (field: keyof AthleteGameStats, delta: number) => {
    const updated: AthleteGameStats = {
      ...gameStats,
      [field]: Math.max(0, gameStats[field] + delta),
    };
    updateAthleteGameStats(myAthleteProfile.id, updated);
  };

  // Handle local file upload (Photos & Videos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const objectUrl = URL.createObjectURL(file);

    addAthleteMedia(myAthleteProfile.id, {
      type: isVideo ? 'video' : 'photo',
      url: objectUrl,
      title: mediaTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
      tag: mediaTag,
    });

    setMediaTitle('');
    triggerToast(`${isVideo ? 'Vídeo' : 'Foto'} adicionado(a) à galeria de lances do jogador!`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddMediaByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrlInput.trim()) return;

    addAthleteMedia(myAthleteProfile.id, {
      type: mediaType,
      url: mediaUrlInput.trim(),
      title: mediaTitle.trim() || 'Lance de Futevôlei na Arena',
      tag: mediaTag,
    });

    setMediaUrlInput('');
    setMediaTitle('');
    triggerToast('Mídia adicionada ao portfólio do jogador!');
  };

  const handleAddAchievementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!achTitle.trim() || !achTourn.trim()) return;

    addAthleteAchievement(myAthleteProfile.id, {
      title: achTitle.trim(),
      tournamentName: achTourn.trim(),
      year: achYear,
      placement: achPlacement,
    });

    setAchTitle('');
    setAchTourn('');
    triggerToast('Conquista adicionada ao currículo do atleta!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Automatic Waitlist Notification Banner */}
      {waitlistNotifications.length > 0 && (
        <div className="space-y-2.5">
          {waitlistNotifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-[#071D3D] border-2 border-[#0987CE] rounded-2xl p-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-in fade-in text-[#F7FAFD]"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0987CE] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold uppercase tracking-wider text-[#0987CE] text-[11px]">
                      Disparo Automático · Lista de Espera
                    </span>
                    <span className="text-[#12C7BB] font-mono text-[11px]">às {notif.timestamp}</span>
                  </div>
                  <p className="text-slate-200 font-medium">
                    Reserva cancelada em <strong>{notif.waitlistEntry.courtName}</strong> ({notif.waitlistEntry.date} às{' '}
                    <strong>{notif.waitlistEntry.startTime}</strong>).
                  </p>
                  <p className="text-emerald-400 font-bold">
                    ✓ Próximo cliente da lista notificado automaticamente: {notif.waitlistEntry.customerName} (WhatsApp:{' '}
                    {notif.waitlistEntry.customerPhone})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const booked = claimWaitlistSlot(notif.waitlistEntry.id);
                    triggerToast(
                      `Horário das ${booked.startTime} assumido e confirmado para ${booked.customerName}!`
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Confirmar Reserva p/ {notif.waitlistEntry.customerName.split(' ')[0]} (1 Clique)
                </button>

                <a
                  href={notif.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Abrir WhatsApp Enviado
                </a>

                <button
                  onClick={() => dismissWaitlistNotification(notif.id)}
                  className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Dispensar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelToast && (
        <div className="p-3.5 bg-slate-900 text-white text-xs rounded-xl flex items-center justify-between animate-in fade-in shadow-md">
          <span>{cancelToast}</span>
          <button onClick={() => setCancelToast(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODELO COMPLETO DE PERFIL DE JOGADOR DE FUTEVÔLEI                     */}
      {/* ===================================================================== */}
      <div className="bg-[#071D3D] border border-[#145A9B] rounded-2xl p-6 shadow-xl space-y-6 text-[#F7FAFD]">
        <div className="bg-[#030B17] border border-[#145A9B] text-white rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black uppercase text-[10px] shadow-xs">
                ATLETA SHARK SET
              </span>
              <AthleteLevelBadge
                level={myAthleteProfile.level}
                size="md"
                showTierNumber
                points={myAthleteProfile.points}
              />
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide ${
                  myAthleteProfile.experienceCategory === 'profissional'
                    ? 'bg-[#12C7BB] text-slate-950 font-black'
                    : 'bg-[#071D3D] text-slate-200 border border-[#145A9B]'
                }`}
              >
                Experiência: {myAthleteProfile.experienceCategory === 'profissional' ? 'Profissional' : 'Amador'}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-300 font-semibold">
                {myAthleteProfile.city}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Perfil Oficial SHARK SET: {myAthleteProfile.name}
            </h1>

            <p className="text-xs text-slate-300 max-w-2xl">
              Ficha técnica com data de nascimento, nível de experiência (Amador/Profissional), estatísticas de jogo (aces, erros, shark attack e aproveitamento), galeria de fotos/vídeos e conquistas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('register_dupla')}
              className="px-4 py-2.5 text-xs font-extrabold text-white bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer"
            >
              Ver Ranking Geral
            </button>
            <button
              onClick={() => {
                setArenaSubTab('agenda');
                setActiveTab('scheduler');
              }}
              className="px-4 py-2.5 text-xs font-black text-slate-950 bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              RESERVAR QUADRA
            </button>
          </div>
        </div>

        {/* Dados Pessoais, Data de Nascimento, Experiência (Amador/Profissional) & Posição */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">Nome do Jogador</label>
            <input
              type="text"
              value={myAthleteProfile.name}
              onChange={(e) => updateAthleteProfile(myAthleteProfile.id, { name: e.target.value })}
              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-900"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">
              Data de Nascimento {athleteAge !== null ? `(${athleteAge} anos)` : ''}
            </label>
            <input
              type="date"
              value={myAthleteProfile.birthDate || '1994-05-18'}
              onChange={(e) => updateAthleteProfile(myAthleteProfile.id, { birthDate: e.target.value })}
              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-900"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">
              Nível de Experiência
            </label>
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {(['amador', 'profissional'] as ExperienceCategory[]).map((exp) => (
                <button
                  key={exp}
                  type="button"
                  onClick={() => {
                    updateAthleteProfile(myAthleteProfile.id, { experienceCategory: exp });
                    triggerToast(`Nível de experiência atualizado para ${exp.toUpperCase()}!`);
                  }}
                  className={`py-1.5 px-2 rounded-lg font-bold capitalize cursor-pointer transition-colors ${
                    (myAthleteProfile.experienceCategory || 'amador') === exp
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">Lado na Quadra</label>
            <select
              value={myAthleteProfile.courtSide || 'Direita'}
              onChange={(e) =>
                updateAthleteProfile(myAthleteProfile.id, {
                  courtSide: e.target.value as 'Direita' | 'Esquerda' | 'Ambos',
                })
              }
              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
            >
              <option value="Direita">Direita</option>
              <option value="Esquerda">Esquerda</option>
              <option value="Ambos">Ambos os Lados</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">Pé Dominante</label>
            <select
              value={myAthleteProfile.dominantFoot || 'Destro'}
              onChange={(e) =>
                updateAthleteProfile(myAthleteProfile.id, {
                  dominantFoot: e.target.value as 'Destro' | 'Canhoto' | 'Ambidestro',
                })
              }
              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
            >
              <option value="Destro">Destro</option>
              <option value="Canhoto">Canhoto</option>
              <option value="Ambidestro">Ambidestro</option>
            </select>
          </div>
        </div>

        {/* Estatísticas de Jogo (Aces, Erros, Shark Attack, Pingos, Defesas e Aproveitamento) */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                Estatísticas de Jogo & Aproveitamento Técnico
              </h2>
              <span className="text-xs text-slate-500">
                Clique em <strong>+</strong> ou <strong>-</strong> para atualizar aces, erros e fundamentos em tempo real
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono">
                Aproveitamento Vitórias: <strong>{winRatePercent}%</strong> ({myAthleteProfile.wins}V / {myAthleteProfile.matchesPlayed}J)
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono">
                Eficiência Técnica: <strong>{technicalEfficiencyPercent}%</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* Stat 1: Aces */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">Saques Ace</span>
                <span className="text-2xl font-extrabold font-mono text-emerald-700 tabular-nums">
                  {gameStats.aces}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAdjustStat('aces', -1)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 cursor-pointer"
                >
                  -1
                </button>
                <button
                  onClick={() => handleAdjustStat('aces', 1)}
                  className="flex-1 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Stat 2: Erros */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-rose-700 block">Erros Não Forçados</span>
                <span className="text-2xl font-extrabold font-mono text-rose-600 tabular-nums">
                  {gameStats.errors}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAdjustStat('errors', -1)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 cursor-pointer"
                >
                  -1
                </button>
                <button
                  onClick={() => handleAdjustStat('errors', 1)}
                  className="flex-1 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Stat 3: Shark Attacks */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-amber-800 block">Shark Attacks 🦈</span>
                <span className="text-2xl font-extrabold font-mono text-amber-700 tabular-nums">
                  {gameStats.sharkAttacks}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAdjustStat('sharkAttacks', -1)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 cursor-pointer"
                >
                  -1
                </button>
                <button
                  onClick={() => handleAdjustStat('sharkAttacks', 1)}
                  className="flex-1 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Stat 4: Pingos & Diagonal */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">Pingos & Diagonal</span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
                  {gameStats.pingoPoints}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAdjustStat('pingoPoints', -1)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 cursor-pointer"
                >
                  -1
                </button>
                <button
                  onClick={() => handleAdjustStat('pingoPoints', 1)}
                  className="flex-1 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Stat 5: Defesas */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">Defesas & Cobertura</span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
                  {gameStats.defenses}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAdjustStat('defenses', -1)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 cursor-pointer"
                >
                  -1
                </button>
                <button
                  onClick={() => handleAdjustStat('defenses', 1)}
                  className="flex-1 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Stat 6: Aproveitamento Geral */}
            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/80 flex flex-col justify-between gap-1">
              <span className="text-[11px] font-bold text-emerald-900 block">Aproveitamento</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-800 tabular-nums">
                {winRatePercent}%
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">
                Relação Ace/Erro: {(gameStats.aces / Math.max(1, gameStats.errors)).toFixed(1)}x
              </span>
            </div>
          </div>
        </div>

        {/* Biografia & Conquistas do Atleta */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
          {/* Biografia Esportiva */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-slate-600" />
                Biografia & Estilo de Jogo
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (editingBio) {
                    updateAthleteProfile(myAthleteProfile.id, { bio: bioInput });
                    setEditingBio(false);
                    triggerToast('Biografia do jogador atualizada!');
                  } else {
                    setBioInput(myAthleteProfile.bio || '');
                    setEditingBio(true);
                  }
                }}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
              >
                {editingBio ? 'Salvar Biografia' : 'Editar Biografia'}
              </button>
            </div>

            {editingBio ? (
              <textarea
                rows={4}
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="Conte sua história no futevôlei, principais características em quadra, parceiros e objetivos..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {myAthleteProfile.bio ||
                  'Atleta dedicado ao Futevôlei de areia. Clique em "Editar Biografia" para descrever seu estilo de jogo, lado de preferência e histórico esportivo.'}
              </div>
            )}

            {/* 5 Tier Badges Selector */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Série / Categoria no Ranking:</span>
                <span className="text-slate-500 font-mono text-[11px]">{promoStatus.explanation}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ATHLETE_TIERS.map((tier) => {
                  const isCurrent = myAthleteProfile.level === tier.level;
                  return (
                    <button
                      key={tier.level}
                      type="button"
                      onClick={() => handleLevelSwitch(tier.level)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-slate-900 bg-slate-900 text-white font-bold'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-[10px] block truncate">{tier.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Conquistas & Troféus */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Galeria de Conquistas & Títulos ({(myAthleteProfile.achievements || []).length})
            </h3>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {(myAthleteProfile.achievements || []).map((ach) => (
                <div
                  key={ach.id}
                  className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-amber-900">{ach.placement}</span>
                      <span>·</span>
                      <span className="font-bold text-slate-900">{ach.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {ach.tournamentName} ({ach.year})
                    </span>
                  </div>
                  <button
                    onClick={() => removeAthleteAchievement(myAthleteProfile.id, ach.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Remover conquista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Add Achievement Form */}
            <form onSubmit={handleAddAchievementSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-1">
              <select
                value={achPlacement}
                onChange={(e) => setAchPlacement(e.target.value as AthleteAchievement['placement'])}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              >
                <option value="1º Lugar">🥇 1º Lugar</option>
                <option value="2º Lugar">🥈 2º Lugar</option>
                <option value="3º Lugar">🥉 3º Lugar</option>
                <option value="Destaque">⭐ Destaque</option>
              </select>
              <input
                type="text"
                required
                value={achTitle}
                onChange={(e) => setAchTitle(e.target.value)}
                placeholder="Título (ex: Campeão Série C)"
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                required
                value={achTourn}
                onChange={(e) => setAchTourn(e.target.value)}
                placeholder="Torneio (ex: Open Conflora)"
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
              >
                + Conquista
              </button>
            </form>
          </div>
        </div>

        {/* Seção para Upload de Fotos e Vídeos de Lances de Futevôlei */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-slate-700" />
                Upload de Fotos e Vídeos do Jogador (Lances & Melhores Momentos)
              </h3>
              <p className="text-xs text-slate-500">
                Envie vídeos dos seus jogos, shark attacks, defesas ou fotos de pódio diretamente do seu celular/computador.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-4 h-4" />
                Fazer Upload de Foto ou Vídeo
              </button>
            </div>
          </div>

          {/* Optional URL or Metadata bar */}
          <form
            onSubmit={handleAddMediaByUrl}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs"
          >
            <input
              type="text"
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
              placeholder="Legenda do lance (ex: Shark Attack na Final)"
              className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-lg"
            />
            <select
              value={mediaTag}
              onChange={(e) => setMediaTag(e.target.value)}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg font-semibold"
            >
              <option value="Shark Attack">🦈 Shark Attack</option>
              <option value="Saque Ace">🎯 Saque Ace</option>
              <option value="Defesa Monstra">🛡️ Defesa & Cobertura</option>
              <option value="Pódio & Troféu">🏆 Pódio & Troféu</option>
            </select>
            <input
              type="url"
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              placeholder="Ou cole URL de foto/vídeo..."
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
            >
              Adicionar Mídia
            </button>
          </form>

          {/* Media Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(myAthleteProfile.mediaGallery || []).map((item) => (
              <div
                key={item.id}
                className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between shadow-xs"
              >
                <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  {item.type === 'video' ? (
                    <video src={item.url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-bold">
                    {item.tag}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between gap-2 text-xs bg-white">
                  <div className="truncate">
                    <span className="font-bold text-slate-900 block truncate">{item.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.type === 'video' ? '🎥 Vídeo' : '📷 Foto'} · {item.createdAt}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAthleteMedia(myAthleteProfile.id, item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    title="Remover mídia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Row: Quadras que mais joga + Lista de Espera */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quadras que mais joga */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Quadras que Você Mais Joga
              </h2>
              <span className="text-xs text-slate-500">
                Reagende em 1 clique nas suas quadras favoritas
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favoriteCourts.map((fav, idx) => (
              <div
                key={fav.courtId}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-700">#{idx + 1} Mais Jogada</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {fav.count} {fav.count === 1 ? 'reserva' : 'reservas'}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">{fav.courtName}</h3>
                  <p className="text-xs text-slate-500">{fav.arenaName}</p>
                </div>

                <button
                  onClick={() => {
                    setTenantId(fav.tenantId);
                    setArenaSubTab('agenda');
                    setActiveTab('scheduler');
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Reagendar nesta Quadra
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de Espera para Quadras Esgotadas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-500" />
                Lista de Espera para Quadras Esgotadas ({activeWaitlistEntries.length})
              </h2>
              <span className="text-xs text-slate-500">
                Notificação automática ao 1º da fila em caso de cancelamento
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {activeWaitlistEntries.map((entry) => {
              const isNotified = entry.status === 'notified';
              return (
                <div
                  key={entry.id}
                  className={`border rounded-xl p-3 text-xs flex items-center justify-between gap-2 ${
                    isNotified ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {isNotified ? '🔔 VAGA LIBERADA' : `${entry.position}º da Fila`} · {entry.customerName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {entry.courtName.split(' - ')[0]} · {entry.date} às {entry.startTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isNotified && (
                      <button
                        onClick={() => {
                          const booked = claimWaitlistSlot(entry.id);
                          triggerToast(`Horário das ${booked.startTime} confirmado para ${booked.customerName}!`);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                      >
                        Assumir Vaga
                      </button>
                    )}
                    <button
                      onClick={() => leaveWaitlist(entry.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Histórico Completo de Reservas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Histórico de Reservas de Quadra</h2>
            <span className="text-xs text-slate-500">
              Cancele uma reserva com fila de espera ativa para testar o disparo automático ao próximo cliente
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500">{bookings.length} registros</span>
        </div>

        <div className="space-y-3">
          {bookings.map((booking) => {
            const isCancelled = booking.status === 'cancelled';
            const waLink = generateBookingWhatsAppLink(booking, tenant.whatsapp, booking.arenaName || tenant.name);

            const waitingForThisBooking = waitlist
              .filter(
                (w) =>
                  w.courtId === booking.courtId &&
                  w.date === booking.date &&
                  w.startTime === booking.startTime &&
                  w.status === 'waiting'
              )
              .sort((a, b) => a.position - b.position);

            return (
              <div
                key={booking.id}
                className={`border rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCancelled ? 'opacity-50 border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900">
                      {sportLabels[booking.sport] || booking.sport}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-800">{booking.courtName}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-700 font-medium">Cliente: {booking.customerName}</span>
                    <span className="text-slate-300">·</span>
                    <span className={`font-semibold ${isCancelled ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {isCancelled ? 'Cancelado' : 'Confirmado'}
                    </span>
                    {!isCancelled && waitingForThisBooking.length > 0 && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        ⏳ {waitingForThisBooking.length} na Lista de Espera (1º: {waitingForThisBooking[0].customerName})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                    <div className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {booking.startTime} às {booking.endTime}
                      </span>
                    </div>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono font-bold text-slate-900">R$ {booking.price.toFixed(2)}</span>
                  </div>
                </div>

                {!isCancelled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Comprovante WA
                    </a>

                    <button
                      onClick={() => handleCancel(booking.id, booking.courtName, booking.startTime)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {waitingForThisBooking.length > 0
                        ? 'Cancelar & Notificar 1º da Fila'
                        : 'Cancelar'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
