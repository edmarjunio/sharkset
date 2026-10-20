import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Sparkles,
  Layers,
  ChevronRight,
  User,
  ShieldCheck,
  Calendar,
  Building2,
  Lock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { AthleteLevel, AthleteProfile, RankingMatchLog, RankingScope } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import { SharkCard3D, SharkCardTerritorialRankings } from './SharkCard3D';
import { auth, signInWithGooglePopup } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { UserProfileModal } from './UserProfileModal';

interface SharkCardsShowcaseProps {
  athletes: AthleteProfile[];
  rankingLogs: RankingMatchLog[];
  onBookCourtClick?: () => void;
}

export const SharkCardsShowcase: React.FC<SharkCardsShowcaseProps> = ({
  athletes,
  rankingLogs,
  onBookCourtClick,
}) => {
  const { userProfile, tenant } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<AthleteLevel>('serie_a');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const currentUser = auth.currentUser;

  // Find user's own athlete record if logged in
  const myAthlete = useMemo(() => {
    if (!currentUser) return null;
    const uName = (currentUser.displayName || userProfile.name || '').trim().toLowerCase();
    return athletes.find((a) => a.name.toLowerCase() === uName) || null;
  }, [currentUser, athletes, userProfile.name]);

  // Compute territorial rankings for a given athlete
  const getTerritorialRankings = (ath: AthleteProfile): SharkCardTerritorialRankings => {
    const sortedAll = [...athletes].sort((a, b) => (b.points || 0) - (a.points || 0));
    const genIndex = sortedAll.findIndex((a) => a.id === ath.id);

    const sameCountry = sortedAll.filter((a) => (a.country || 'Brasil') === (ath.country || 'Brasil'));
    const countryIndex = sameCountry.findIndex((a) => a.id === ath.id);

    const sameState = sortedAll.filter((a) => (a.state || 'GO') === (ath.state || 'GO'));
    const stateIndex = sameState.findIndex((a) => a.id === ath.id);

    const sameCity = sortedAll.filter((a) => (a.city || 'Mineiros') === (ath.city || 'Mineiros'));
    const cityIndex = sameCity.findIndex((a) => a.id === ath.id);

    const sameArena = sortedAll.filter((a) => (a.arenaId || '') === (ath.arenaId || ''));
    const arenaIndex = sameArena.findIndex((a) => a.id === ath.id);

    return {
      generalRank: genIndex >= 0 ? genIndex + 1 : undefined,
      countryRank: countryIndex >= 0 ? countryIndex + 1 : undefined,
      stateRank: stateIndex >= 0 ? stateIndex + 1 : undefined,
      cityRank: cityIndex >= 0 ? cityIndex + 1 : undefined,
      arenaRank: arenaIndex >= 0 ? arenaIndex + 1 : undefined,
    };
  };

  // Athletes filtered by chosen category tab
  const categoryAthletes = useMemo(() => {
    return athletes
      .filter((a) => a.level === selectedCategory)
      .sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [athletes, selectedCategory]);

  // Currently showcased athlete in the category gallery
  const activeShowcaseAthlete = useMemo(() => {
    if (selectedAthleteId) {
      const found = categoryAthletes.find((a) => a.id === selectedAthleteId);
      if (found) return found;
    }
    return categoryAthletes[0] || null;
  }, [categoryAthletes, selectedAthleteId]);

  // Match logs filtered for active athlete
  const activeAthleteLogs = useMemo(() => {
    if (!activeShowcaseAthlete) return [];
    const name = activeShowcaseAthlete.name.toLowerCase();
    return rankingLogs.filter(
      (m) =>
        m.winnerNames.toLowerCase().includes(name) ||
        m.loserNames.toLowerCase().includes(name)
    );
  }, [activeShowcaseAthlete, rankingLogs]);

  // Match logs for user's own athlete
  const myAthleteLogs = useMemo(() => {
    if (!myAthlete) return [];
    const name = myAthlete.name.toLowerCase();
    return rankingLogs.filter(
      (m) =>
        m.winnerNames.toLowerCase().includes(name) ||
        m.loserNames.toLowerCase().includes(name)
    );
  }, [myAthlete, rankingLogs]);

  const categoriesList: AthleteLevel[] = [
    'iniciante',
    'serie_c',
    'serie_b',
    'serie_a',
    'profissional',
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#031526] via-[#072445] to-[#02101e] border-2 border-cyan-500/40 p-5 sm:p-7 shadow-2xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-black text-[10px] tracking-wider uppercase border border-cyan-500/30">
                NOVIDADE EXCLUSIVA · TCG SHARK SET
              </span>
              <span className="text-[11px] text-amber-400 font-black flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Edição de Colecionador 2026
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cards 3D Colecionáveis dos Atletas
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Inspirados nos cartões colecionáveis clássicos com cores exclusivas para cada categoria, efeito holográfico 3D interativo, rankings territoriais e súmula no verso.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
              Temporada 2026
            </span>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-cyan-300 text-xs font-mono font-bold">
              {athletes.length} Atletas Ranqueados
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SEÇÃO 1: "MEU SHARK CARD" (SE LOGADO) OU GANCHO DE DESBLOQUEIO        */}
      {/* ===================================================================== */}
      <div className="bg-[#041628]/95 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Seu Card Oficial de Atleta
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              O seu card personalizado exclusivo com seus pontos, domínios e histórico de jogos homologados.
            </p>
          </div>

          {currentUser && myAthlete && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Card Ativo & Homologado</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
          {/* Card Render */}
          {!currentUser ? (
            /* User Not Logged In */
            <SharkCard3D
              athlete={null}
              isLocked
              lockReason="Faça login com sua conta Google para emitir e desbloquear o seu Card Oficial 3D no SHARK SET."
              onUnlockClick={() => setLoginModalOpen(true)}
            />
          ) : !myAthlete || (myAthlete.matchesPlayed || 0) === 0 ? (
            /* User Logged In, but No Matches Played yet */
            <SharkCard3D
              athlete={
                myAthlete || {
                  id: 'my-card',
                  name: currentUser.displayName || userProfile.name || 'Atleta SHARK SET',
                  level: userProfile.level || 'iniciante',
                  points: 0,
                  wins: 0,
                  matchesPlayed: 0,
                  titlesCount: 0,
                  experienceCategory: 'amador',
                  city: 'Mineiros',
                  state: 'GO',
                  country: 'Brasil',
                  arenaName: tenant?.name || 'Arena Credenciada',
                  phone: userProfile.phone || '',
                  preferredSport: 'futevolei',
                }
              }
              isLocked
              lockReason="VOCÊ PRECISA JOGAR PELO MENOS 1 PARTIDA HOMOLOGADA PARA ENTRAR NO RANKING E TER SEU PRÓPRIO CARD! JOGUE AGORA E DESBLOQUEIE MAIS ESSA!"
              onUnlockClick={onBookCourtClick}
            />
          ) : (
            /* User Logged In & Has Matches */
            <SharkCard3D
              athlete={myAthlete}
              territorialRankings={getTerritorialRankings(myAthlete)}
              recentMatches={myAthleteLogs}
              sponsorName="APRESENTADO POR SHARK SET CIRCUIT"
            />
          )}

          {/* Gamification Guidance Panel */}
          <div className="max-w-md space-y-4 text-xs text-slate-300">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Como Evoluir o seu Shark Card?
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Cada vitória oficial nas quadras credenciadas soma pontos imediatos no seu Card, elevando sua posição geral, estadual e municipal.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black shrink-0 text-xs">
                  1
                </div>
                <div>
                  <strong className="text-white block font-bold">Jogue em Arenas Oficiais:</strong>
                  <span>As súmulas e placares são auditados e gravados direto no verso do seu Card 3D.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  2
                </div>
                <div>
                  <strong className="text-white block font-bold">Suba de Categoria:</strong>
                  <span>Alcance os pontos necessários para evoluir a cor e raridade da sua moldura metálica.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black shrink-0 text-xs">
                  3
                </div>
                <div>
                  <strong className="text-white block font-bold">Compartilhe sua Conquista:</strong>
                  <span>Use o botão de WhatsApp para exibir seu Card atualizado nos grupos de futevôlei e stories!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SEÇÃO 2: GALERIA DOS CARDS POR CATEGORIA (TOP PLAYERS 3D)             */}
      {/* ===================================================================== */}
      <div className="bg-[#041628]/95 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Galeria de Cards por Categoria
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione a categoria técnica para inspecionar os Cards 3D dos atletas líderes do circuito.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {categoriesList.map((lvl) => {
              const isSelected = selectedCategory === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(lvl);
                    setSelectedAthleteId(null);
                  }}
                  className={`py-1.5 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md scale-105'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10'
                  }`}
                >
                  {ATHLETE_LEVEL_LABELS[lvl]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Athletes List Selector & Active 3D Card */}
        {categoryAthletes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Trophy className="w-10 h-10 mx-auto text-slate-600" />
            <p className="font-bold text-white text-sm">
              Nenhum atleta homologado nesta categoria ainda.
            </p>
            <p className="text-xs">
              Seja o primeiro a disputar uma partida oficial na categoria {ATHLETE_LEVEL_LABELS[selectedCategory]} e forjar o primeiro Card!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Athlete List (Left Column) */}
            <div className="lg:col-span-5 space-y-2 max-h-[530px] overflow-y-auto pr-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                Atletas Ranqueados ({categoryAthletes.length}):
              </span>

              {categoryAthletes.map((ath, idx) => {
                const isSelected = (activeShowcaseAthlete?.id === ath.id);
                return (
                  <button
                    key={ath.id}
                    type="button"
                    onClick={() => setSelectedAthleteId(ath.id)}
                    className={`w-full p-3 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md font-bold'
                        : 'bg-slate-900/70 hover:bg-slate-800/80 border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 shadow-md'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-white/10 text-slate-300'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 truncate">
                        <span className="text-xs font-extrabold text-white block truncate">
                          {ath.name}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {ath.city || 'Mineiros'} · {ath.arenaName || 'Arena Matriz'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-cyan-300 block">
                        {(ath.points || 0).toLocaleString('pt-BR')} pts
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        {ath.wins || 0}V - {Math.max(0, (ath.matchesPlayed || 0) - (ath.wins || 0))}D
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active 3D Card Display (Right Column) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center p-2">
              {activeShowcaseAthlete && (
                <SharkCard3D
                  athlete={activeShowcaseAthlete}
                  territorialRankings={getTerritorialRankings(activeShowcaseAthlete)}
                  recentMatches={activeAthleteLogs}
                  sponsorName="APRESENTADO POR SHARK SET CIRCUIT 2026"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <UserProfileModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </div>
  );
};
