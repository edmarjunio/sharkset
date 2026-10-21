import React, { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import {
  Trophy,
  Flame,
  Zap,
  Shield,
  Star,
  RotateCw,
  Share2,
  Download,
  Lock,
  MapPin,
  Building2,
  Calendar,
  CheckCircle,
  Award,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { AthleteLevel, AthleteProfile, RankingMatchLog } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import { SharksetLogo } from './SharksetLogo';
import { AccessLockedAction } from './AccessLockedAction';

export interface SharkCardTerritorialRankings {
  generalRank?: number;
  countryRank?: number;
  stateRank?: number;
  cityRank?: number;
  arenaRank?: number;
}

interface SharkCard3DProps {
  athlete: AthleteProfile | null;
  territorialRankings?: SharkCardTerritorialRankings;
  recentMatches?: RankingMatchLog[];
  isLocked?: boolean;
  lockReason?: string;
  onUnlockClick?: () => void;
  sponsorName?: string;
}

// Category themes inspired by Pokémon TCG holographic cards
export const CATEGORY_THEMES: Record<
  AthleteLevel,
  {
    gradientBorder: string;
    headerBg: string;
    cardBg: string;
    foilHue: string;
    badgeLabel: string;
    badgeBg: string;
    badgeText: string;
    accentColor: string;
    glowShadow: string;
    stars: number;
    specialMove: string;
  }
> = {
  iniciante: {
    gradientBorder: 'from-cyan-300 via-teal-400 to-cyan-600',
    headerBg: 'bg-gradient-to-r from-cyan-900/90 to-teal-900/90',
    cardBg: 'from-[#031d2e] via-[#021422] to-[#010a12]',
    foilHue: 'rgba(6, 182, 212, 0.35)',
    badgeLabel: 'ROOKIE · INICIANTE',
    badgeBg: 'bg-cyan-500',
    badgeText: 'text-slate-950',
    accentColor: '#06b6d4',
    glowShadow: 'shadow-[0_0_30px_rgba(6,182,212,0.4)]',
    stars: 1,
    specialMove: 'Saque Chapado ⚡',
  },
  serie_c: {
    gradientBorder: 'from-emerald-300 via-green-400 to-teal-600',
    headerBg: 'bg-gradient-to-r from-emerald-950/90 to-green-900/90',
    cardBg: 'from-[#022316] via-[#02170f] to-[#010b07]',
    foilHue: 'rgba(16, 185, 129, 0.35)',
    badgeLabel: 'CHALLENGER · SÉRIE C',
    badgeBg: 'bg-emerald-400',
    badgeText: 'text-slate-950',
    accentColor: '#10b981',
    glowShadow: 'shadow-[0_0_30px_rgba(16,185,129,0.45)]',
    stars: 2,
    specialMove: 'Pingo de Ombro ⚡',
  },
  serie_b: {
    gradientBorder: 'from-sky-300 via-blue-500 to-indigo-600',
    headerBg: 'bg-gradient-to-r from-blue-950/90 to-sky-900/90',
    cardBg: 'from-[#031c38] via-[#021226] to-[#010914]',
    foilHue: 'rgba(56, 189, 248, 0.4)',
    badgeLabel: 'ELITE · SÉRIE B',
    badgeBg: 'bg-sky-400',
    badgeText: 'text-slate-950',
    accentColor: '#38bdf8',
    glowShadow: 'shadow-[0_0_30px_rgba(56,189,248,0.5)]',
    stars: 3,
    specialMove: 'Shark Attack 🦈',
  },
  serie_a: {
    gradientBorder: 'from-rose-400 via-purple-500 to-violet-600',
    headerBg: 'bg-gradient-to-r from-purple-950/90 to-rose-950/90',
    cardBg: 'from-[#230521] via-[#150314] to-[#090109]',
    foilHue: 'rgba(244, 63, 94, 0.45)',
    badgeLabel: 'MASTER · SÉRIE A',
    badgeBg: 'bg-gradient-to-r from-rose-500 to-purple-500',
    badgeText: 'text-white',
    accentColor: '#f43f5e',
    glowShadow: 'shadow-[0_0_35px_rgba(244,63,94,0.55)]',
    stars: 4,
    specialMove: 'Ataque de Calcanhar Supremo 🔥',
  },
  profissional: {
    gradientBorder: 'from-amber-200 via-yellow-400 to-amber-600',
    headerBg: 'bg-gradient-to-r from-amber-950/90 to-yellow-900/90',
    cardBg: 'from-[#261c02] via-[#171101] to-[#080600]',
    foilHue: 'rgba(251, 191, 36, 0.55)',
    badgeLabel: 'LENDÁRIO · PROFISSIONAL',
    badgeBg: 'bg-gradient-to-r from-amber-300 to-yellow-500',
    badgeText: 'text-slate-950',
    accentColor: '#fbbf24',
    glowShadow: 'shadow-[0_0_45px_rgba(251,191,36,0.65)]',
    stars: 5,
    specialMove: 'Shark Attack Voador Lendário 👑',
  },
};

export const SharkCard3D: React.FC<SharkCard3DProps> = ({
  athlete,
  territorialRankings,
  recentMatches = [],
  isLocked = false,
  lockReason,
  onUnlockClick,
  sponsorName = 'SHARK SET CIRCUITO NACIONAL 2026',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const requiresLogin = lockReason?.toLowerCase().includes('login') ?? false;

  const level: AthleteLevel = athlete?.level || 'iniciante';
  const theme = CATEGORY_THEMES[level];

  // Calculations
  const matches = athlete?.matchesPlayed || 0;
  const wins = athlete?.wins || 0;
  const losses = Math.max(0, matches - wins);
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  const points = athlete?.points || 0;
  const serialNumber = athlete ? `#SHK-2026-${(athlete.id.replace(/[^0-9]/g, '').slice(0, 4) || '001')}` : '#SHK-LOCKED';

  // 3D Tilt handlers (Desktop)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isLocked) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -14;
    const rotY = ((x - centerX) / centerX) * 14;

    setRotate({ x: rotX, y: rotY });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.85,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  // Touch drag for Mobile
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || isLocked || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -12;
    const rotY = ((x - centerX) / centerX) * 12;

    setRotate({ x: rotX, y: rotY });
    setGlare({
      x: Math.max(0, Math.min(100, (x / rect.width) * 100)),
      y: Math.max(0, Math.min(100, (y / rect.height) * 100)),
      opacity: 0.8,
    });
  };

  const handleTouchEnd = () => {
    setRotate({ x: 0, y: 0 });
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  // Export card image via html2canvas
  const handleDownloadImage = async () => {
    if (!cardRef.current || isExporting) return;
    try {
      setIsExporting(true);
      // Reset tilt before capture to ensure crisp image
      setRotate({ x: 0, y: 0 });
      setGlare((prev) => ({ ...prev, opacity: 0 }));

      // Wait a frame for DOM to stabilize
      await new Promise((r) => setTimeout(r, 120));

      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        backgroundColor: null,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `SharkCard-${athlete?.name.replace(/\s+/g, '_') || 'Atleta'}-2026.png`;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem do card:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!athlete) return;
    const lines = [
      `🦈 *SHARK SET · CARD OFICIAL DO ATLETA* 🎴`,
      `🏆 *${athlete.name}* (${ATHLETE_LEVEL_LABELS[athlete.level]})`,
      `⚡ *${points.toLocaleString('pt-BR')} PTS* · Aproveitamento: *${winRate}%* (${wins}V - ${losses}D)`,
      ``,
      `📍 *Rankings Territoriais:*`,
      territorialRankings?.generalRank ? `🌍 Geral: *#${territorialRankings.generalRank}*` : null,
      territorialRankings?.countryRank ? `🇧🇷 Brasil: *#${territorialRankings.countryRank}*` : null,
      territorialRankings?.stateRank ? `📍 Estado (${athlete.state || 'GO'}): *#${territorialRankings.stateRank}*` : null,
      territorialRankings?.cityRank ? `🏙️ Cidade (${athlete.city || 'Mineiros'}): *#${territorialRankings.cityRank}*` : null,
      territorialRankings?.arenaRank ? `🏟️ Arena: *#${territorialRankings.arenaRank}*` : null,
      ``,
      `Confira o card interativo e o ranking completo ao vivo em:`,
      `👉 https://sharkset.web.app`,
    ].filter(Boolean);

    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* 3D Perspective Card Wrapper */}
      <div
        style={{ perspective: 1200 }}
        className="relative group cursor-pointer transition-transform duration-200"
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y + (isFlipped ? 180 : 0)}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.18s ease-out',
          }}
          className={`relative w-[320px] sm:w-[350px] min-h-[510px] rounded-[28px] p-[5px] bg-gradient-to-b ${theme.gradientBorder} ${theme.glowShadow} overflow-hidden`}
        >
          {/* Holographic Prismatic Sheen Overlay */}
          <div
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 40%, rgba(0,0,0,0) 70%)`,
              opacity: glare.opacity,
              transition: 'opacity 0.25s ease-out',
            }}
            className="absolute inset-0 pointer-events-none z-30 mix-blend-overlay rounded-[24px]"
          />

          {/* ================================================================= */}
          {/* FACE 1: FRENTE DO CARD (ESTILO TCG / POKÉMON COM CORES SHARKSET)  */}
          {/* ================================================================= */}
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className={`w-full h-full rounded-[24px] bg-gradient-to-b ${theme.cardBg} border border-white/20 p-3.5 flex flex-col justify-between text-white relative overflow-hidden`}
          >
            {/* Locked Secret Card State */}
            {isLocked ? (
              <div className="flex flex-col items-center justify-between h-full py-4 px-2 text-center space-y-4">
                <div className="flex items-center justify-between w-full border-b border-white/10 pb-2">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    CARD COLECIONÁVEL
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
                    BLOQUEADO
                  </span>
                </div>

                <div className="relative my-auto flex flex-col items-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-slate-900/90 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-pulse">
                    <Lock className="w-9 h-9" />
                  </div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    CARD HOMOLOGADO BLOQUEADO
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-[260px]">
                    {lockReason ||
                      'Você precisa jogar pelo menos 1 Partida Homologada em uma arena credenciada para forjar seu Card Colecionável e entrar no ranking oficial. Jogue agora e desbloqueie mais essa!'}
                  </p>
                </div>

                {/* Gamified Unlock Checklist */}
                <div className="w-full bg-slate-950/80 rounded-2xl p-3 border border-white/10 space-y-2 text-left text-[11px]">
                  <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                    Ganchos de Desbloqueio:
                  </span>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    <span>Disputar 1ª Partida Homologada (0/1)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    <span>1ª Vitória ativa seu golpe especial</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                      3
                    </span>
                    <span>Jogue na sua cidade para o Selo Municipal</span>
                  </div>
                </div>

                {onUnlockClick && requiresLogin ? (
                  <AccessLockedAction
                    message="Faça login para emitir seu Card"
                    onClick={onUnlockClick}
                    className="w-full rounded-xl"
                    previewClassName="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg border border-amber-300 items-center justify-center gap-1.5 inline-flex"
                  >
                    <span>Jogar Agora & Desbloquear</span>
                    <ArrowRight className="w-4 h-4" />
                  </AccessLockedAction>
                ) : onUnlockClick && (
                  <button
                    type="button"
                    onClick={onUnlockClick}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Jogar Agora & Desbloquear</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Top Header: Badge, Player Name, Points "HP" & Sport */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-black tracking-wider text-slate-300 uppercase border-b border-white/10 pb-1.5">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Sparkles className="w-3 h-3" />
                      STAGE 1 · SHARK SET TCG
                    </span>
                    <span className="font-mono text-slate-400">{serialNumber}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate drop-shadow-md">
                        {athlete?.name || 'Atleta SHARK SET'}
                      </h2>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                        <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${theme.badgeBg} ${theme.badgeText}`}>
                          {theme.badgeLabel}
                        </span>
                        <span>· Edição #1</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-white/15 shadow-inner">
                      <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                      <div className="text-right">
                        <span className="text-[9px] block leading-none font-bold text-slate-400">PONTOS</span>
                        <strong className="text-xs sm:text-sm font-black font-mono text-amber-300">
                          {points.toLocaleString('pt-BR')}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Card Image Frame with Holographic Sunburst */}
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-white/20 bg-slate-950 my-2 shadow-inner group">
                  {/* Sunburst background rays */}
                  <div
                    style={{
                      background: `repeating-conic-gradient(from 0deg, ${theme.accentColor}25 0deg 15deg, transparent 15deg 30deg)`,
                    }}
                    className="absolute inset-0 opacity-40 animate-spin [animation-duration:35s]"
                  />

                  {athlete?.photoUrl ? (
                    <img
                      src={athlete.photoUrl}
                      alt={athlete.name}
                      className="relative z-10 w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-1">
                      <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-white/30 flex items-center justify-center text-cyan-300 font-black text-2xl shadow-lg">
                        {(athlete?.name || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-300">
                        ATLETA HOMOLOGADO
                      </span>
                    </div>
                  )}

                  {/* Certified Watermark Stamp */}
                  <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-400/40 text-[9px] font-black uppercase tracking-wider text-cyan-300 shadow-md flex items-center gap-1">
                    <Shield className="w-3 h-3 text-cyan-400" />
                    <span>CERTIFICADO</span>
                  </div>

                  {/* Location & Home Arena Bar */}
                  <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-2 pt-4 text-[10px] flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-200 font-bold truncate">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{athlete?.city || 'Mineiros'} - {athlete?.state || 'GO'}</span>
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-bold shrink-0">
                      <Building2 className="w-3 h-3 text-amber-400" />
                      <span className="truncate max-w-[110px]">{athlete?.arenaName || 'Arena Credenciada'}</span>
                    </span>
                  </div>
                </div>

                {/* Territorial Domain Box (As habilidades territoriais estilo Pokémon) */}
                <div className="bg-slate-950/70 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 space-y-1.5 shadow-md">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-cyan-300 border-b border-white/10 pb-1">
                    <span>DOMÍNIO TERRITORIAL (RANKING)</span>
                    <span className="text-slate-400 font-mono">SCOPES</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className="p-1 rounded-xl bg-white/5 border border-white/5">
                      <span className="block text-[8px] font-bold text-slate-400">🌍 GERAL</span>
                      <strong className="text-xs font-black text-white font-mono">
                        {territorialRankings?.generalRank ? `#${territorialRankings.generalRank}` : 'Top 50'}
                      </strong>
                    </div>
                    <div className="p-1 rounded-xl bg-white/5 border border-white/5">
                      <span className="block text-[8px] font-bold text-slate-400">🇧🇷 BRASIL</span>
                      <strong className="text-xs font-black text-cyan-300 font-mono">
                        {territorialRankings?.countryRank ? `#${territorialRankings.countryRank}` : '#1'}
                      </strong>
                    </div>
                    <div className="p-1 rounded-xl bg-white/5 border border-white/5">
                      <span className="block text-[8px] font-bold text-slate-400">🏙️ CIDADE</span>
                      <strong className="text-xs font-black text-amber-300 font-mono">
                        {territorialRankings?.cityRank ? `#${territorialRankings.cityRank}` : '#1'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Battle Stats & Special Signature Move */}
                <div className="bg-slate-950/80 rounded-2xl p-2.5 border border-white/10 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-200">Ataque Especial:</span>
                    </div>
                    <span className="font-black text-cyan-300">{theme.specialMove}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1 border-t border-white/5">
                    <span>Aproveitamento: <strong className="text-emerald-400 font-mono">{winRate}%</strong></span>
                    <span>Vitórias/Derrotas: <strong className="text-white font-mono">{wins}V - {losses}D</strong></span>
                    <span>Partidas: <strong className="text-white font-mono">{matches}</strong></span>
                  </div>
                </div>

                {/* Season Sponsor / Footer */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px] text-slate-400">
                  <span className="font-bold truncate max-w-[190px]">
                    ⭐ {sponsorName}
                  </span>
                  <span className="font-mono text-cyan-300 font-bold shrink-0">
                    SHARK SET © 2026
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ================================================================= */}
          {/* FACE 2: VERSO DO CARD (3D FLIP 180° COM HISTÓRICO DAS PARTIDAS)  */}
          {/* ================================================================= */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            className="absolute inset-0 w-full h-full rounded-[24px] bg-[#020b17] border border-cyan-500/40 p-4 flex flex-col justify-between text-white overflow-hidden shadow-2xl"
          >
            {/* Top Back Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <div className="flex items-center gap-2">
                <SharksetLogo size="sm" showText={false} />
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    SÚMULA HOMOLOGADA
                  </h3>
                  <p className="text-[9px] text-cyan-300 font-mono">REGISTRO DE PARTIDAS OFICIAIS</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black border border-cyan-500/30">
                VERSO OFICIAL
              </span>
            </div>

            {/* Recent Matches Timeline */}
            <div className="space-y-2 my-auto">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                Últimas Partidas Oficiais:
              </span>

              {recentMatches.length > 0 ? (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {recentMatches.slice(0, 4).map((m, idx) => {
                    const isWinner = athlete && m.winnerNames.toLowerCase().includes(athlete.name.toLowerCase());
                    return (
                      <div
                        key={m.id || idx}
                        className="p-2 rounded-xl bg-slate-900/90 border border-white/5 space-y-1 text-[10px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                            isWinner ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {isWinner ? '✓ Vitória' : '✕ Derrota'}
                          </span>
                          <span className="font-mono font-bold text-amber-300">{m.score}</span>
                        </div>
                        <div className="text-slate-300 truncate">
                          vs {isWinner ? m.loserNames : m.winnerNames}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">
                          {m.tournamentName || 'Partida Homologada'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-dashed border-slate-700 text-center space-y-1 text-slate-400">
                  <UserCheck className="w-6 h-6 mx-auto text-cyan-400" />
                  <p className="text-xs font-bold text-white">Aguardando Novas Partidas</p>
                  <p className="text-[10px] leading-snug">
                    Todas as partidas disputadas em arenas parceiras são registradas e auditadas automaticamente neste verso.
                  </p>
                </div>
              )}
            </div>

            {/* Back Footer: QR Code & Verification */}
            <div className="pt-2 border-t border-cyan-500/30 flex items-center justify-between text-[9px] text-slate-400">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Selo de Autenticidade Shark</span>
                <span className="text-[8px] font-mono text-cyan-400">Auditado por Google Firestore</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#020b17" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M10 10h4v4h-4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tactile Controls: Flip 3D, Download Image & WhatsApp Share */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full max-w-[350px]">
        <button
          type="button"
          onClick={() => setIsFlipped((prev) => !prev)}
          className="flex-1 py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
          title="Girar carta para ver o verso com partidas"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>{isFlipped ? 'Ver Frente' : 'Virar Carta (3D)'}</span>
        </button>

        {!isLocked && (
          <>
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              title="Baixar imagem em alta resolução"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Baixando...' : 'Baixar'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              title="Compartilhar no WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </>
        )}
      </div>
      <p className="text-[10px] text-slate-400 text-center">
        💡 <em>Dica: No computador passe o mouse para inclinar em 3D; no celular deslize com o dedo.</em>
      </p>
    </div>
  );
};
