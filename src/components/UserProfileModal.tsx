import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LogOut,
  LogIn,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Trophy,
  CalendarCheck,
  Check,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Flame,
  Zap,
  Star,
  Award,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Percent,
  Activity,
  Layers,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  auth,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
  getGoogleRedirectResult,
  signOutFirebase,
} from '../lib/firebase';
import { AthleteLevel, AthleteProfile } from '../types';
import {
  ATHLETE_TIERS,
  ATHLETE_LEVEL_LABELS,
  getRankingPromotionSuggestion,
  getInitialFloorPointsForLevel,
} from '../services/rankingValidator';
import { SharkCard3D, SharkCardTerritorialRankings } from './SharkCard3D';
import { IntegrityReportModal } from './IntegrityReportModal';
import { getInactivityDays, INACTIVITY_DAYS } from '../services/rankingActivity';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, setUserProfile, setActiveTab, bookings, athletes, rankingLogs, tenant } = useApp();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string; tip?: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Check if returning from redirect login
    getGoogleRedirectResult()
      .then((result) => {
        if (result?.user) {
          onClose();
        }
      })
      .catch((err) => {
        handleAuthCatch(err);
      });
  }, []);

  const currentUser = auth.currentUser;
  const isLoggedIn = Boolean(currentUser);

  const handleAuthCatch = (error: unknown) => {
    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code || 'auth/unknown';
    let tip = 'Ocorreu um erro ao autenticar com o Google. Tente novamente.';

    if (code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'sharkset.web.app';
      tip = `O domínio "${currentHost}" não está na lista de "Domínios autorizados" do Firebase.\n\nPara liberar o login com Google no Console do Firebase:\n1. Acesse o Console Firebase (projeto sharkset-70de4)\n2. Menu Authentication > Configurações > Domínios autorizados\n3. Adicione "${currentHost}"`;
    } else if (code === 'auth/operation-not-allowed') {
      tip = 'O provedor Google ainda não está ativado no Firebase Console (Authentication > Sign-in method > Google).';
    } else if (code === 'auth/popup-blocked') {
      tip = 'O navegador bloqueou a janela pop-up do Google. Clique no botão de Redirecionamento abaixo.';
    } else if (code === 'auth/popup-closed-by-user') {
      tip = 'A janela do Google foi fechada antes de autenticar.';
    } else if (errObj?.message) {
      tip = errObj.message;
    }

    setAuthError({
      code,
      message: errObj?.message || 'Falha na autenticação',
      tip,
    });
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      setIsLoggingIn(true);
      await signInWithGooglePopup();
      onClose();
    } catch (error) {
      handleAuthCatch(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setAuthError(null);
    try {
      setIsRedirecting(true);
      await signInWithGoogleRedirect();
    } catch (error) {
      handleAuthCatch(error);
      setIsRedirecting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOutFirebase();
      onClose();
    } catch (error) {
      console.error('Erro ao sair da conta:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Find user's registered athlete record
  const currentAthleteRecord: AthleteProfile | null = useMemo(() => {
    if (!currentUser) return null;
    const nameSearch = (currentUser.displayName || userProfile.name || '').trim().toLowerCase();
    const found = athletes.find((a) => a.name.toLowerCase() === nameSearch);
    if (found) return found;

    if (!userProfile.level) return null;

    return {
      id: `ath-${currentUser.uid.slice(0, 12)}`,
      name: currentUser.displayName || userProfile.name || 'Atleta SHARK SET',
      phone: userProfile.phone || currentUser.phoneNumber || '',
      photoUrl: currentUser.photoURL || undefined,
      level: userProfile.level,
      points: getInitialFloorPointsForLevel(userProfile.level),
      wins: 0,
      matchesPlayed: 0,
      titlesCount: 0,
      experienceCategory: userProfile.level === 'profissional' ? 'profissional' : 'amador',
      preferredSport: 'futevolei',
      country: 'Brasil',
      state: 'GO',
      city: 'Mineiros',
      arenaId: tenant?.id || '',
      arenaName: tenant?.name || '',
      bio: '',
      achievements: [],
      mediaGallery: [],
      stats: {
        aces: 0,
        errors: 0,
        sharkAttacks: 0,
        pingoPoints: 0,
        defenses: 0,
      },
    };
  }, [currentUser, userProfile, athletes, tenant]);

  // Compute Territorial Rankings
  const territorialRankings: SharkCardTerritorialRankings = useMemo(() => {
    if (!currentAthleteRecord) return {};
    const sorted = [...athletes].sort((a, b) => (b.points || 0) - (a.points || 0));
    const genIndex = sorted.findIndex((a) => a.id === currentAthleteRecord.id);

    const sameCountry = sorted.filter((a) => (a.country || 'Brasil') === (currentAthleteRecord.country || 'Brasil'));
    const countryIndex = sameCountry.findIndex((a) => a.id === currentAthleteRecord.id);

    const sameState = sorted.filter((a) => (a.state || 'GO') === (currentAthleteRecord.state || 'GO'));
    const stateIndex = sameState.findIndex((a) => a.id === currentAthleteRecord.id);

    const sameCity = sorted.filter((a) => (a.city || 'Mineiros') === (currentAthleteRecord.city || 'Mineiros'));
    const cityIndex = sameCity.findIndex((a) => a.id === currentAthleteRecord.id);

    return {
      generalRank: genIndex >= 0 ? genIndex + 1 : undefined,
      countryRank: countryIndex >= 0 ? countryIndex + 1 : undefined,
      stateRank: stateIndex >= 0 ? stateIndex + 1 : undefined,
      cityRank: cityIndex >= 0 ? cityIndex + 1 : undefined,
    };
  }, [currentAthleteRecord, athletes]);

  // Filter athlete's recent matches
  const recentAthleteMatches = useMemo(() => {
    if (!currentAthleteRecord) return [];
    const name = currentAthleteRecord.name.toLowerCase();
    return rankingLogs.filter(
      (m) =>
        m.winnerNames.toLowerCase().includes(name) ||
        m.loserNames.toLowerCase().includes(name)
    );
  }, [currentAthleteRecord, rankingLogs]);

  // Gamified metrics
  const matchesCount = currentAthleteRecord?.matchesPlayed || 0;
  const winsCount = currentAthleteRecord?.wins || 0;
  const lossesCount = Math.max(0, matchesCount - winsCount);
  const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0;
  const titles = currentAthleteRecord?.titlesCount || 0;
  const points = currentAthleteRecord?.points || 0;
  const athleteLevel = currentAthleteRecord?.level || userProfile.level || 'iniciante';

  const promoStatus = useMemo(() => {
    return getRankingPromotionSuggestion(
      points,
      titles,
      athleteLevel,
      winsCount,
      matchesCount
    );
  }, [points, titles, athleteLevel, winsCount, matchesCount]);

  if (!isOpen) return null;

  const inactDays = getInactivityDays(currentAthleteRecord?.lastMatchAt);
  const isResetDue = inactDays !== null && inactDays >= INACTIVITY_DAYS;
  const isWarningDue = inactDays !== null && inactDays >= 25 && inactDays < INACTIVITY_DAYS;

  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl my-auto rounded-3xl bg-[#030E1F]/98 border-2 border-cyan-500/40 shadow-[0_0_50px_rgba(0,0,0,0.9)] p-5 sm:p-7 text-white flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-[#12C7BB] to-blue-600 shadow-[0_0_15px_rgba(18,199,187,0.8)]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {!isLoggedIn ? (
          /* ================= NOT LOGGED IN STATE ================= */
          <div className="min-h-0 overflow-y-auto overscroll-contain py-4 space-y-5 text-center">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-slate-900 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_25px_rgba(18,199,187,0.35)]">
              <User className="w-10 h-10" />
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase tracking-wider">
                Acesso de Atleta Oficial
              </span>
              <h2 id="user-profile-title" className="text-2xl font-black text-white tracking-tight">
                Entrar no SHARK SET
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Conecte sua conta Google para liberar seu Card Colecionável 3D, salvar seu ranking MMR, gerenciar reservas e competir nas arenas homologadas.
              </p>
            </div>

            {/* Aviso Regras de Categoria */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-left space-y-1.5 max-w-md mx-auto">
              <div className="flex items-center gap-1.5 font-black text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Importante sobre a Categoria do Atleta:</span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                O atleta <strong>só poderá dizer sua categoria após criar a conta</strong> (ou no primeiro login). Após essa escolha inicial única, ela fica travada e <strong>não pode ser alterada manualmente</strong> — somente por pontuação e ranking MMR do app.
              </p>
            </div>

            <div className="pt-2 max-w-md mx-auto space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoggingIn ? 'Autenticando com Google...' : 'Entrar com Google'}</span>
              </button>

              {authError && (
                <div className="w-full text-left p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Aviso de Conexão ({authError.code})</span>
                  </div>
                  <p className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed font-sans bg-black/40 p-2.5 rounded-xl border border-white/5">
                    {authError.tip}
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleRedirectLogin}
                    disabled={isRedirecting}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRedirecting ? 'animate-spin' : ''}`} />
                    <span>{isRedirecting ? 'Redirecionando...' : 'Tentar via Redirecionamento (Sem Pop-up)'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : currentUser ? (
          /* ================= LOGGED IN USER PROFILE (GAMIFIED ATHLETE CARD) ================= */
          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-5">
            {/* 1. Header do Atleta */}
            <div className="flex items-center justify-between gap-3 pt-1 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Atleta'}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-400 shadow-[0_0_15px_rgba(18,199,187,0.4)]"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 border-2 border-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-md">
                      {(currentUser.displayName || userProfile.name || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[#030E1F] shadow-[0_0_8px_rgba(16,185,129,0.95)]" />
                </div>
                <div className="min-w-0">
                  <h2 id="user-profile-title" className="text-lg font-black text-white truncate">
                    {currentUser.displayName || userProfile.name || 'Atleta SHARK SET'}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
                    <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{currentUser.email}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Conta Autenticada</span>
                  </div>
                </div>
              </div>

              {/* Botão de Denúncia de Integridade */}
              {currentAthleteRecord && (
                <button
                  type="button"
                  onClick={() => setReportTarget({ id: currentAthleteRecord.id, name: currentAthleteRecord.name })}
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors shrink-0 cursor-pointer"
                  title="Abrir canal de integridade e denúncia"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. CARTÃO DO ATLETA (OFICIAL DO RANKING 3D TCG) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#12C7BB]" />
                  Cartão do Atleta Oficial
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Gire o card para ver a súmula
                </span>
              </div>

              <div className="flex justify-center p-2 rounded-3xl bg-slate-950/70 border border-cyan-500/20 shadow-inner">
                <SharkCard3D
                  athlete={currentAthleteRecord}
                  territorialRankings={territorialRankings}
                  recentMatches={recentAthleteMatches}
                />
              </div>
            </div>

            {/* 3. ESTATÍSTICAS GAMIFICADAS COMPLETAS */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Estatísticas Competitivas & Performance
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Pontos MMR */}
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pontos MMR</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-cyan-300 tabular-nums">{points}</span>
                    <span className="text-[10px] font-bold text-slate-400">pts</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                    {ATHLETE_LEVEL_LABELS[athleteLevel]}
                  </span>
                </div>

                {/* Vitórias / Derrotas */}
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">V / D (Jogos)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-400 tabular-nums">{winsCount}</span>
                    <span className="text-xs text-slate-400">/</span>
                    <span className="text-lg font-black text-rose-400 tabular-nums">{lossesCount}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {matchesCount} disputados
                  </span>
                </div>

                {/* Aproveitamento */}
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Aproveitamento</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-amber-400 tabular-nums">{winRate}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Taxa de vitória</span>
                </div>

                {/* Títulos / Pódios */}
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Títulos & Troféus</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-amber-300 tabular-nums">{titles}</span>
                    <span className="text-xs font-bold text-amber-400">🏆</span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold mt-0.5">1º Lugar</span>
                </div>
              </div>

              {/* Fundamentos de Jogo (Se houver stats) */}
              {currentAthleteRecord?.stats && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <span className="text-[11px] font-black uppercase text-slate-400 block">
                    Fundamentos Técnicos Registrados
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Aces</span>
                      <strong className="text-sm font-black text-cyan-300 tabular-nums">
                        {currentAthleteRecord.stats.aces}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Shark Attacks</span>
                      <strong className="text-sm font-black text-orange-400 tabular-nums">
                        {currentAthleteRecord.stats.sharkAttacks}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Pingos</span>
                      <strong className="text-sm font-black text-emerald-400 tabular-nums">
                        {currentAthleteRecord.stats.pingoPoints}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Defesas</span>
                      <strong className="text-sm font-black text-sky-400 tabular-nums">
                        {currentAthleteRecord.stats.defenses}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Erros</span>
                      <strong className="text-sm font-black text-rose-400 tabular-nums">
                        {currentAthleteRecord.stats.errors}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. TRAVA DE CATEGORIA & PROGRESSÃO POR MMR */}
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Categoria Oficial: {ATHLETE_LEVEL_LABELS[athleteLevel]}
                </span>
                <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/40">
                  🔒 Fixada no Cadastro · Subida por MMR
                </span>
              </div>

              {/* Barra de Evolução de XP */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Progresso de MMR / Promoção
                  </span>
                  <span className="font-mono text-cyan-300">{promoStatus.progressPercent}% XP</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-500 transition-all duration-500 shadow-[0_0_10px_rgba(18,199,187,0.7)]"
                    style={{ width: `${Math.min(100, promoStatus.progressPercent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {promoStatus.explanation}
                </p>
              </div>

              {/* Indicador das 5 Categorias (Apenas Leitura / Travadas) */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {ATHLETE_TIERS.map((tier) => {
                  const isCurrent = athleteLevel === tier.level;
                  return (
                    <div
                      key={tier.level}
                      className={`p-1.5 rounded-xl border text-center select-none transition-all ${
                        isCurrent
                          ? 'border-cyan-400 bg-gradient-to-br from-cyan-600 to-blue-700 text-white font-black shadow-md shadow-cyan-500/25 ring-2 ring-cyan-300'
                          : 'border-white/5 bg-slate-950/60 text-slate-500 opacity-60'
                      }`}
                      title={isCurrent ? 'Sua categoria ativa' : 'Progressão automática por MMR'}
                    >
                      <span className="text-[10px] block truncate font-bold">{tier.label}</span>
                      <span className="text-[9px] block opacity-80">{tier.minPoints} pts</span>
                    </div>
                  );
                })}
              </div>

              {/* REGRAS CLARAS DE INATIVIDADE E INTEGRIDADE */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                <div className="font-black text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Regras do Ranking & Integridade:</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  🔒 Você <strong>só pôde escolher sua categoria uma única vez</strong> no cadastro. Não é permitido alterar manualmente; a evolução ocorre exclusivamente por jogos e MMR no app.
                </p>
                <div className="pt-1 border-t border-amber-500/20 text-[10px] text-amber-300/90 space-y-0.5">
                  <p>
                    ⚠️ <strong>Regra de 30 Dias:</strong> Se ficar 30 dias sem pontuar no ranking você será <strong>desclassificado do ranking</strong>. Quanto mais tempo sem jogar, mais pontos você perde!
                  </p>
                  <p>
                    🚨 <strong>Denúncia de Nível:</strong> Os outros atletas podem te denunciar caso seu ranking não seja o mesmo citado. Fique atento e jogue na categoria certa!
                  </p>
                </div>

                {/* Status de Inatividade Atual do Jogador */}
                {isResetDue ? (
                  <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-200 font-bold text-[10px]">
                    ⚠️ Inativo há mais de 30 dias! Seus pontos foram resetados. Dispute uma partida homologada para reativar seu progresso.
                  </div>
                ) : isWarningDue ? (
                  <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-600/50 text-amber-200 font-bold text-[10px]">
                    ⏳ Atenção: Você está há {inactDays} dias sem jogar. Ao atingir 30 dias você será desclassificado do ranking ativo!
                  </div>
                ) : null}
              </div>
            </div>

            {/* 5. Ações Rápidas */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('my_bookings');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-cyan-500/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Minhas Reservas & Agenda</div>
                    <div className="text-[10px] text-slate-400">
                      {activeBookingsCount} reserva(s) confirmada(s)
                    </div>
                  </div>
                </div>
                <span className="text-xs text-cyan-400 font-bold">Abrir &rarr;</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-extrabold transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoggingOut ? 'Saindo...' : 'Sair da conta'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal de Denúncia de Integridade */}
      {reportTarget && (
        <IntegrityReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="athlete"
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onReportSubmitted={() => {
            setReportTarget(null);
          }}
        />
      )}
    </div>,
    document.body
  );
};
