import { LocationScopeFilter } from './LocationScopeFilter';
import { PodiumCardStudio } from './PodiumCardStudio';
import { useScopedCatalog } from '../hooks/useScopedCatalog';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { useBroadcastNavigation } from '../store/useBroadcastNavigation';
import { matchPhaseLabel } from '../services/bracketPresentation';
import { TournamentOperationsPanel } from './TournamentOperationsPanel';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import {
  AthleteLevel,
  BracketMatch,
  MatchSet,
  SemiFormat,
  TeamPair,
  TournamentCategory,
  TournamentModalityFormat,
} from '../types';
import { generateMatchCallWhatsAppLink } from '../services/whatsappAdapter';
import { computeTournamentStandings, getPodium, officializeMatch } from '../services/bracketEngine';
import {
  ATHLETE_LEVEL_LABELS,
  TOURNAMENT_CATEGORY_LABELS,
  validatePairCategory,
} from '../services/rankingValidator';
import { evaluateMatchNearCompletion } from '../services/smartAlertEngine';
import { RefereeConsoleModal } from './RefereeConsoleModal';
import { MatchLiveDetailsModal } from './MatchLiveDetailsModal';
import { FutevoleiVisualBracketCanvas } from './FutevoleiVisualBracketCanvas';
import {
  exportBracketToCSV,
  exportBracketToPDF,
  openBracketPrintWindow,
} from '../services/bracketExportService';
import { ShareBracketModal } from './ShareBracketModal';
import { MatchHistoryModal } from './MatchHistoryModal';
import { SharksetLogo } from './SharksetLogo';
import { IntegrityReportModal } from './IntegrityReportModal';
import { toast } from '../store/useToastStore';
import { AthleteEmailSelector } from './AthleteEmailSelector';
import {
  Trophy,
  MessageSquare,
  RotateCcw,
  Check,
  Sparkles,
  Sliders,
  Plus,
  MapPin,
  Calendar,
  Award,
  AlertCircle,
  BellRing,
  Radio,
  Shuffle,
  ArrowUp,
  ArrowDown,
  Play,
  ShieldAlert,
  Flag,
  Timer,
  Download,
  FileSpreadsheet,
  Printer,
  Share2,
  Swords,
  Maximize2,
  Minimize2,
  Eye,
  Zap,
  Coins,
  Building2,
  User,
  ShoppingCart,
} from 'lucide-react';

interface DoubleEliminationBracketProps {
  minimalistPlayerView?: boolean;
}

export const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({
  minimalistPlayerView = false,
}) => {
  const {
    tenant,
    tournaments,
    activeTournamentId,
    setActiveTournamentId,
    tournamentMatches,
    applyTournamentEdit,
    registeredPairs,
    registerDouble,
    togglePairPlayerPayment,
    togglePairPresence,
    startTournamentWithDraw,
    createTournament,
    handleAdvanceMatch,
    updateLiveRefereeMatch,
    notifyLiveMatchProgress,
    handleResetMatch,
    handleOverrideMatch,
    updateTournamentConfig,
    athletes,
    userProfile,
    buyTournamentTokens,
    setActiveTab,
    setArenaSubTab,
    availableTenants,
  } = useApp();

  const scopedTournaments = useScopedCatalog(tournaments, tournament => availableTenants.find(arena => arena.id === tournament.tenantId) || {});

  const [activeStageTab, setActiveStageTab] = useState<
    'all' | 'standings' | 'winners' | 'losers' | 'final'
  >('all');
  const [bracketViewMode, setBracketViewMode] = useState<'chaveamento' | 'lista'>('chaveamento');
  const [editingMatch, setEditingMatch] = useState<BracketMatch | null>(null);
  const [operationsMatchId, setOperationsMatchId] = useState('');
  const [refereeModalMatchId, setRefereeModalMatchId] = useState<string | null>(null);
  const [selectedLiveMatchId, setSelectedLiveMatchId] = useState<string | null>(null);

  // Fullscreen & Semifinals Knockout Focus Mode
  const { active: isFullscreen, setFullscreen: setIsFullscreen } = useImmersiveMode();
  const [manualKnockoutToggle, setManualKnockoutToggle] = useState<boolean | null>(null);

  // Share & Match History / MVP Voting Modal States
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMatch, setShareMatch] = useState<BracketMatch | null>(null);
  const [showMatchHistoryModal, setShowMatchHistoryModal] = useState(false);
  const [historyPair1, setHistoryPair1] = useState<TeamPair | null>(null);
  const [historyPair2, setHistoryPair2] = useState<TeamPair | null>(null);
  const [activeHistoryMatchId, setActiveHistoryMatchId] = useState<string | undefined>(undefined);

  // GSAP Winning Team Path Highlight State
  const [activePathHighlight, setActivePathHighlight] = useState<{
    winner: TeamPair;
    matchSteps: Array<{
      matchId: string;
      matchNumber: number;
      stageName: string;
      isDestination?: boolean;
    }>;
    completedMatch: BracketMatch;
  } | null>(null);

  const [reportMatchTarget, setReportMatchTarget] = useState<{ id: string; name: string } | null>(null);

  const handleOpenShare = (match?: BracketMatch) => {
    setShareMatch(match || null);
    setShowShareModal(true);
  };

  const handleOpenMatchHistory = (
    p1?: TeamPair | null,
    p2?: TeamPair | null,
    matchId?: string
  ) => {
    setHistoryPair1(p1 || null);
    setHistoryPair2(p2 || null);
    setActiveHistoryMatchId(matchId);
    setShowMatchHistoryModal(true);
  };

  // Start Tournament & Draw Modal State (Present Pairs + Random or Manual Slot Placement)
  const [showStartDrawModal, setShowStartDrawModal] = useState(false);
  const [drawMode, setDrawMode] = useState<'random' | 'manual'>('random');
  const [manualSlotOrder, setManualSlotOrder] = useState<string[]>([]);

  const [inputScore1, setInputScore1] = useState<number>(18);
  const [inputScore2, setInputScore2] = useState<number>(14);
  const [overrideTeam1Id, setOverrideTeam1Id] = useState<string>('');
  const [overrideTeam2Id, setOverrideTeam2Id] = useState<string>('');
  const [overrideCourt, setOverrideCourt] = useState<string>('');
  const [overrideTime, setOverrideTime] = useState<string>('');

  // Inline scores state per match card for direct 1-click entry
  const [inlineScores, setInlineScores] = useState<Record<string, { s1: string; s2: string }>>({});

  // Create or Edit Tournament Modal State
  const [showTournamentModal, setShowTournamentModal] = useState<'create' | 'edit' | null>(null);
  const [formScope, setFormScope] = useState<'arena' | 'user'>('arena');
  const [formTenantId, setFormTenantId] = useState<string>(tenant.id);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('2026-10-25');
  const [formLocation, setFormLocation] = useState('');
  const [formModality, setFormModality] = useState<TournamentModalityFormat>('duplas');
  const [formCategory, setFormCategory] = useState<TournamentCategory>('iniciante_serie_c');
  const [formSemiFormat, setFormSemiFormat] = useState<SemiFormat>('semi_direta');
  const [formMaxParticipants, setFormMaxParticipants] = useState<number>(8);
  const [formFee, setFormFee] = useState<number>(120);
  const [formRules, setFormRules] = useState('');
  const [formResponsible, setFormResponsible] = useState('');
  const tournamentSaveLock = useRef(false);

  // Quick Registration Modal inside Tournament View
  const [showQuickEnrollModal, setShowQuickEnrollModal] = useState(false);
  const [enrollP1, setEnrollP1] = useState('');
  const [enrollP2, setEnrollP2] = useState('');
  const quickEnrollLock = useRef(false);

  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];
  const isSingles = activeTournament?.modalityFormat === 'simples';

  const currentMatches = activeTournament ? tournamentMatches.filter((m) => m.tournamentId === activeTournament.id) : [];
  const pairsInTourn = activeTournament ? registeredPairs.filter((p) => p.tournamentId === activeTournament.id) : [];
  const activePairsInTourn = pairsInTourn.filter((p) => p.enrollmentStatus !== 'rejected');
  const presentPairsInTourn = activePairsInTourn.filter((p) => p.isPresent !== false && p.enrollmentStatus === 'confirmed');
  const confirmedPairsCount = activePairsInTourn.filter((p) => p.enrollmentStatus === 'confirmed').length;
  const enrolledAthleteEmails = useMemo(
    () => new Set(pairsInTourn
      .filter((pair) => pair.enrollmentStatus !== 'rejected')
      .flatMap((pair) => [pair.player1Email, pair.player2Email])
      .filter((email): email is string => Boolean(email))
      .map((email) => email.trim().toLowerCase())),
    [pairsInTourn]
  );
  const selectedEnrollPlayer1 = athletes.find(
    (athlete) => (athlete.email || '').trim().toLowerCase() === enrollP1
  ) || null;
  const selectedEnrollPlayer2 = athletes.find(
    (athlete) => (athlete.email || '').trim().toLowerCase() === enrollP2
  ) || null;

  const liveMatches = useMemo(() => {
    return currentMatches.filter(
      (m) =>
        m.status === 'in_progress' ||
        (m.status !== 'completed' && m.liveReferee && ((m.score1 ?? 0) > 0 || (m.score2 ?? 0) > 0))
    );
  }, [currentMatches]);
  const liveBroadcastTournamentIds = useMemo(
    () => new Set(tournamentMatches
      .filter((match) => Boolean(match.linkedBroadcastId) && match.status === 'in_progress')
      .map((match) => match.tournamentId)),
    [tournamentMatches]
  );

  const activeRefereeMatch = useMemo(() => {
    if (!refereeModalMatchId) return null;
    return currentMatches.find((m) => m.id === refereeModalMatchId) || null;
  }, [currentMatches, refereeModalMatchId]);

  const selectedLiveMatch = useMemo(() => {
    if (!selectedLiveMatchId) return null;
    return currentMatches.find((m) => m.id === selectedLiveMatchId) || null;
  }, [currentMatches, selectedLiveMatchId]);

  // Automatic detection when tournament reaches Semifinals:
  // If all qualifying matches (winners & losers before semifinals) are completed OR any semifinal has both teams ready
  const hasReachedSemifinalsAutomatically = useMemo(() => {
    const semiMatchesList = currentMatches.filter((m) => m.stage === 'semifinals');
    const qualifyingMatches = currentMatches.filter(
      (m) =>
        (m.stage === 'winners' || m.stage === 'losers') &&
        !m.stageName.toLowerCase().includes('3º lugar')
    );
    if (semiMatchesList.length === 0) return false;
    const allQualifyingDone =
      qualifyingMatches.length > 0 && qualifyingMatches.every((m) => m.status === 'completed');
    const anySemiReady = semiMatchesList.some((m) => !!m.team1 && !!m.team2);
    return allQualifyingDone || anySemiReady;
  }, [currentMatches]);

  const knockoutOnlyMode =
    manualKnockoutToggle !== null ? manualKnockoutToggle : hasReachedSemifinalsAutomatically;

  // 1-Click Helper to simulate advancing all qualifying matches to Semifinals so user can immediately see Knockout Mode
  const handleSimulateAdvanceToSemifinals = () => {
    const qualifying = currentMatches
      .filter(
        (m) =>
          (m.stage === 'winners' || m.stage === 'losers') &&
          !m.stageName.toLowerCase().includes('3º lugar')
      )
      .sort((a, b) => a.matchNumber - b.matchNumber);

    if (qualifying.some(match => match.status !== 'completed')) {
      triggerToast('Finalize os jogos classificatórios antes de abrir as semifinais.');
      return;
    }
    setManualKnockoutToggle(true);
    setBracketViewMode('chaveamento');
    triggerToast(
      '⚡ Fase Semifinal ativada! Jogos classificatórios passados foram minimizados e a tabela exibe o Mata-Mata (Semifinais, Grande Final e DISPUTA DE 3º).'
    );
  };

  const openStartDrawModal = () => {
    const initialIds = presentPairsInTourn.map((p) => p.id);
    setManualSlotOrder(initialIds);
    setShowStartDrawModal(true);
  };

  const moveManualPair = (index: number, direction: -1 | 1) => {
    setManualSlotOrder((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleConfirmStartTournamentDraw = () => {
    if (presentPairsInTourn.length < 4) {
      triggerToast('Confirme a inscrição e a presença de pelo menos 4 duplas para gerar a tabela.');
      return;
    }
    const presentIds = presentPairsInTourn.map((p) => p.id);
    const orderedIds =
      drawMode === 'manual'
        ? [
            ...manualSlotOrder.filter((id) => presentIds.includes(id)),
            ...presentIds.filter((id) => !manualSlotOrder.includes(id)),
          ]
        : presentIds;

    try { startTournamentWithDraw(activeTournament.id, drawMode, orderedIds); }
    catch (error) { triggerToast(error instanceof Error ? error.message : 'Falha ao gerar tabela.'); return; }
    setManualKnockoutToggle(null);
    setShowStartDrawModal(false);
    toast.success(
      drawMode === 'random'
        ? `Torneio iniciado! Tabela gerada e alertas WhatsApp disparados para as ${presentPairsInTourn.length} duplas!`
        : `Torneio iniciado! Tabela gerada com alocação manual e alertas WhatsApp disparados!`
    );
  };

  // Automatic Tournament Standings generated from match results
  const standings = useMemo(() => {
    return computeTournamentStandings(currentMatches, activePairsInTourn);
  }, [currentMatches, activePairsInTourn]);

  const winnersMatches = currentMatches.filter((m) => m.stage === 'winners');
  const losersMatches = currentMatches.filter(
    (m) => m.stage === 'losers' && !m.stageName.toLowerCase().includes('3º lugar')
  );
  const semiMatches = currentMatches.filter((m) => m.stage === 'semifinals');
  const thirdPlaceMatches = currentMatches.filter(
    (m) => m.stage === 'third_place' || m.stageName.toLowerCase().includes('3º lugar')
  );
  const grandFinalMatches = currentMatches.filter(
    (m) => m.stage === 'grand_final' || m.stage === 'super_final'
  );

  const podium = getPodium(currentMatches);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4800);
  };

  const handleExportPDF = async () => {
    try {
      await exportBracketToPDF(activeTournament, currentMatches, standings, podium, tenant);
      triggerToast('📄 PDF Oficial do Torneio gerado e baixado com sucesso!');
    } catch {
      triggerToast('Aviso: Erro ao gerar PDF. Use a opção de Impressão ou Planilha CSV.');
    }
  };

  const handleExportCSV = () => {
    try {
      exportBracketToCSV(activeTournament, currentMatches, standings, podium, tenant);
      triggerToast('📊 Planilha CSV do chaveamento e resultados baixada com sucesso!');
    } catch {
      triggerToast('Aviso: Erro ao exportar planilha CSV.');
    }
  };

  const handlePrintBracket = () => {
    openBracketPrintWindow(activeTournament, currentMatches, standings, podium, tenant);
  };

  const formatParticipantName = (p?: { player1: string; player2: string }) => {
    if (!p) return 'Aguardando definição';
    if (isSingles || p.player2.toLowerCase() === 'individual (1x1)') {
      return p.player1;
    }
    return `${p.player1} & ${p.player2}`;
  };

  // Open Create or Edit Tournament Modal
  const openCreateModal = () => {
    setFormScope('arena');
    setFormTenantId(tenant.id);
    setFormName('');
    setFormDate('2026-10-25');
    setFormLocation(`${tenant.name} - ${tenant.city}/${tenant.state}`);
    setFormModality('duplas');
    setFormCategory('iniciante_serie_c');
    setFormSemiFormat('semi_direta');
    setFormMaxParticipants(8);
    setFormFee(120);
    setFormRules(
      'Preliminares: set único de 18 pontos, diferença de 2. Semifinais, final e 3º lugar: melhor de 3 sets (18/18/15), diferença de 2. Sem reinício da final.'
    );
    setFormResponsible(userProfile.name);
    setShowTournamentModal('create');
  };

  const openEditModal = () => {
    if (!activeTournament) return;
    setFormName(activeTournament.name);
    setFormDate(activeTournament.date);
    setFormLocation(activeTournament.location || `${tenant.name} - ${tenant.city}/${tenant.state}`);
    setFormModality(activeTournament.modalityFormat || 'duplas');
    setFormCategory(activeTournament.category);
    setFormSemiFormat(activeTournament.semiFormat);
    setFormMaxParticipants(activeTournament.maxPairs);
    setFormFee(activeTournament.registrationFee);
    setFormRules(
      activeTournament.specificRules ||
        'Sets de 18 pontos (diferença de 2 pontos). Semifinal direta com disputa de 3º lugar.'
    );
    setFormResponsible(activeTournament.responsibleName);
    setShowTournamentModal('edit');
  };

  const handleSaveTournamentModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (tournamentSaveLock.current || !formName.trim()) return;

    tournamentSaveLock.current = true;
    let saved = false;
    try {
      if (showTournamentModal === 'create') {
        const isUserScope = formScope === 'user';
        const targetTenant = isUserScope
          ? availableTenants.find((a) => a.id === formTenantId) || tenant
          : tenant;
        const targetLocation = isUserScope
          ? `${targetTenant.name} (${targetTenant.city} - ${targetTenant.state})`
          : `${tenant.name} (${tenant.city} - ${tenant.state})`;

        const created = createTournament({
          name: formName.trim(),
          sport: 'futevolei',
          category: formCategory,
          modalityFormat: formModality,
          semiFormat: formSemiFormat,
          date: formDate,
          location: targetLocation,
          tenantId: targetTenant.id,
          createdScope: formScope,
          specificRules: formRules.trim(),
          maxPairs: formMaxParticipants,
          registrationFee: formFee,
          responsibleName: formResponsible.trim() || userProfile.name,
          responsiblePhone: userProfile.phone,
        });
        toast.success(`Torneio "${created.name}" criado com sucesso!`);
        triggerToast(`Torneio "${created.name}" criado com sucesso!`);
      } else if (showTournamentModal === 'edit' && activeTournament) {
        updateTournamentConfig(activeTournament.id, {
          name: formName.trim(),
          date: formDate,
          location: formLocation.trim(),
          modalityFormat: formModality,
          category: formCategory,
          semiFormat: formSemiFormat,
          maxPairs: formMaxParticipants,
          specificRules: formRules.trim(),
          responsibleName: formResponsible.trim(),
        });
        toast.success(`Torneio "${formName.trim()}" atualizado com sucesso!`);
        triggerToast(`Torneio "${formName.trim()}" atualizado com sucesso!`);
      }
      setShowTournamentModal(null);
      saved = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o torneio.');
    } finally {
      if (saved) { window.setTimeout(() => { tournamentSaveLock.current = false; }, 1000); } else { tournamentSaveLock.current = false; }
    }
  };
  // Validate Quick Enroll (Safe even when activeTournament is undefined)
  const activeTournamentCategory = activeTournament?.category || 'iniciante_serie_c';
  const enrollValidation = useMemo(() => {
    if (!selectedEnrollPlayer1) {
      return { isValid: false, reason: 'Selecione um atleta pelo e-mail.', ruleSummary: 'A categoria vem do perfil.' };
    }
    if (isSingles) {
      return {
        isValid: true,
        reason: `Inscrição individual para ${selectedEnrollPlayer1.name} (${ATHLETE_LEVEL_LABELS[selectedEnrollPlayer1.level]}).`,
        ruleSummary: 'Formato Simples 1x1.',
      };
    }
    if (!selectedEnrollPlayer2) {
      return { isValid: false, reason: 'Selecione o segundo atleta pelo e-mail.', ruleSummary: 'A categoria vem do perfil.' };
    }
    if (selectedEnrollPlayer1.email?.trim().toLowerCase() === selectedEnrollPlayer2.email?.trim().toLowerCase()) {
      return { isValid: false, reason: 'A dupla precisa ter e-mails diferentes.', ruleSummary: 'Escolha dois atletas.' };
    }
    return validatePairCategory(activeTournamentCategory, selectedEnrollPlayer1.level, selectedEnrollPlayer2.level);
  }, [isSingles, activeTournamentCategory, selectedEnrollPlayer1, selectedEnrollPlayer2]);

  const handleQuickEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickEnrollLock.current || !activeTournament || !selectedEnrollPlayer1) return;
    if (!isSingles && !selectedEnrollPlayer2) return;
    if (pairsInTourn.filter((pair) => pair.enrollmentStatus !== 'rejected').length >= activeTournament.maxPairs) {
      triggerToast(`Limite máximo de ${activeTournament.maxPairs} participantes atingido!`);
      return;
    }
    if (!enrollValidation.isValid) return;

    quickEnrollLock.current = true;
    try {
      const newEntry = registerDouble({
        tournamentId: activeTournament.id,
        player1Id: selectedEnrollPlayer1.id,
        player1Email: selectedEnrollPlayer1.email,
        player1Phone: selectedEnrollPlayer1.phone,
        player1: selectedEnrollPlayer1.name,
        player1Level: selectedEnrollPlayer1.level,
        player2Id: isSingles ? undefined : selectedEnrollPlayer2?.id,
        player2Email: isSingles ? undefined : selectedEnrollPlayer2?.email,
        player2Phone: isSingles ? undefined : selectedEnrollPlayer2?.phone,
        player2: isSingles ? 'Individual (1x1)' : selectedEnrollPlayer2!.name,
        player2Level: isSingles ? selectedEnrollPlayer1.level : selectedEnrollPlayer2!.level,
        phone: selectedEnrollPlayer1.phone || selectedEnrollPlayer2?.phone || '',
        category: activeTournament.category,
        paymentMethod: 'pix',
      });

      setEnrollP1('');
      setEnrollP2('');
      setShowQuickEnrollModal(false);
      toast.success('Inscrição realizada com sucesso!');
      triggerToast(`Vaga #${newEntry.seed} reservada em ${activeTournament.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a inscrição.');
    } finally {
      quickEnrollLock.current = false;
    }
  };
  const getInlineScore = (match: BracketMatch, side: 's1' | 's2'): string => {
    if (inlineScores[match.id]?.[side] !== undefined) {
      return inlineScores[match.id][side];
    }
    const existing = side === 's1' ? match.score1 : match.score2;
    return existing !== undefined ? String(existing) : '';
  };

  const handleInlineScoreChange = (match: BracketMatch, side: 's1' | 's2', val: string) => {
    const nextS1Str = side === 's1' ? val : getInlineScore(match, 's1');
    const nextS2Str = side === 's2' ? val : getInlineScore(match, 's2');
    setInlineScores((prev) => ({
      ...prev,
      [match.id]: {
        s1: nextS1Str,
        s2: nextS2Str,
      },
    }));

    const parsed1 = parseInt(nextS1Str, 10);
    const parsed2 = parseInt(nextS2Str, 10);
    if (!isNaN(parsed1) && !isNaN(parsed2)) {
      updateLiveRefereeMatch(match.id, (prev) => ({
        ...prev,
        score1: parsed1,
        score2: parsed2,
        status: prev.status === 'completed' ? 'completed' : 'in_progress',
      }));
    }
  };

  /**
   * Smooth GSAP animation that highlights the winning team's trajectory across the bracket
   * whenever a match result is updated or replayed.
   */
  const triggerGsapWinningPathAnimation = (winner: TeamPair, completedMatch: BracketMatch) => {
    const wonMatches = currentMatches
      .filter((m) => m.winnerId === winner.id || m.id === completedMatch.id)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    const steps: Array<{
      matchId: string;
      matchNumber: number;
      stageName: string;
      isDestination?: boolean;
    }> = wonMatches.map((m) => ({
      matchId: m.id,
      matchNumber: m.matchNumber,
      stageName: m.stageName,
      isDestination: false,
    }));

    if (completedMatch.nextMatchWinnerId) {
      const destMatch = currentMatches.find((m) => m.id === completedMatch.nextMatchWinnerId);
      if (destMatch && !steps.some((s) => s.matchId === destMatch.id)) {
        steps.push({
          matchId: destMatch.id,
          matchNumber: destMatch.matchNumber,
          stageName: destMatch.stageName,
          isDestination: true,
        });
      }
    }

    setActivePathHighlight({
      winner,
      matchSteps: steps,
      completedMatch,
    });

    requestAnimationFrame(() => {
      setTimeout(() => {
        const allNodes = document.querySelectorAll('.bracket-match-node');
        if (allNodes.length > 0) {
          gsap.set(allNodes, {
            clearProps: 'boxShadow,scale,borderColor',
          });
        }

        const bannerEl = document.querySelector('.gsap-path-banner');
        if (bannerEl) {
          gsap.fromTo(
            bannerEl,
            { opacity: 0, y: -14, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }
          );
        }

        const stepPills = document.querySelectorAll('.gsap-step-pill');
        if (stepPills.length > 0) {
          gsap.fromTo(
            stepPills,
            { opacity: 0, scale: 0.8, x: -10 },
            { opacity: 1, scale: 1, x: 0, duration: 0.35, stagger: 0.14, ease: 'back.out(1.7)' }
          );
        }

        const targetElements: Element[] = [];
        steps.forEach((st) => {
          const nodes = document.querySelectorAll(`[data-match-id="${st.matchId}"]`);
          nodes.forEach((n) => targetElements.push(n));
        });

        if (targetElements.length > 0) {
          const tl = gsap.timeline();
          tl.fromTo(
            targetElements,
            {
              scale: 1,
              boxShadow: '0 0 0px 0px rgba(18, 199, 187, 0)',
            },
            {
              scale: 1.04,
              borderColor: '#12C7BB',
              boxShadow: '0 0 32px 6px rgba(18, 199, 187, 0.78)',
              duration: 0.42,
              stagger: 0.22,
              ease: 'back.out(1.8)',
            }
          ).to(targetElements, {
            scale: 1,
            borderColor: '#0987CE',
            boxShadow: '0 0 18px 3px rgba(9, 135, 206, 0.55)',
            duration: 0.5,
            stagger: 0.15,
            ease: 'power2.out',
          });
        }
      }, 60);
    });
  };

  const handleInlineSubmit = (match: BracketMatch, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!match.team1 || !match.team2) {
      triggerToast('Defina os participantes antes de confirmar o placar.');
      return;
    }

    const s1Raw = getInlineScore(match, 's1');
    const s2Raw = getInlineScore(match, 's2');
    const s1 = s1Raw === '' ? NaN : Number(s1Raw);
    const s2 = s2Raw === '' ? NaN : Number(s2Raw);

    if (isNaN(s1) || isNaN(s2) || s1 === s2) {
      triggerToast('Insira um placar válido sem empate (ex: 18 x 14) para avançar o vencedor.');
      return;
    }

    const winningTeam: 1 | 2 = s1 > s2 ? 1 : 2;
    const winner = winningTeam === 1 ? match.team1 : match.team2;
    try { handleAdvanceMatch(match.id, winningTeam, s1, s2); }
    catch (error) { triggerToast(error instanceof Error ? error.message : 'Placar inválido.'); return; }
    triggerGsapWinningPathAnimation(winner, match);
    toast.success(
      `Jogo #${match.matchNumber} finalizado (${s1}x${s2})! ${formatParticipantName(winner)} avançou e alertas WhatsApp foram enviados!`
    );
  };

  const handleToggleLiveMatch = (match: BracketMatch) => {
    if (!match.team1 || !match.team2 || match.status === 'completed') return;
    const nextStatus = match.status === 'in_progress' ? 'scheduled' : 'in_progress';
    updateLiveRefereeMatch(match.id, (prev) => ({
      ...prev,
      status: nextStatus,
      score1: prev.score1 ?? 0,
      score2: prev.score2 ?? 0,
    }));
    triggerToast(
      nextStatus === 'in_progress'
        ? `🔴 Jogo #${match.matchNumber} marcado como AO VIVO! Destaque com borda vermelha ativado na tabela.`
        : `Jogo #${match.matchNumber} retirado do modo Ao Vivo.`
    );
  };

  const handleQuickOfficialize = (match: BracketMatch, sets: MatchSet[]) => {
    const nextMatches = officializeMatch(currentMatches, match.id, sets, {
      reason: 'Resultado oficial lançado rapidamente na tabela',
    });
    applyTournamentEdit(activeTournament.id, nextMatches);
    const updated = nextMatches.find((m) => m.id === match.id);
    const winner =
      updated?.winnerId === match.team1?.id
        ? match.team1
        : updated?.winnerId === match.team2?.id
        ? match.team2
        : undefined;
    if (winner) {
      triggerGsapWinningPathAnimation(winner, updated || match);
      toast.success(
        `✅ Jogo #${match.matchNumber} encerrado (${sets.map((s) => `${s.score1}x${s.score2}`).join(' / ')})! ${formatParticipantName(winner)} avançou e alertas WhatsApp foram emitidos!`
      );
    }
  };

  const handleOpenMatchEditor = (match: BracketMatch) => {
    if (match.source1) {
      setOperationsMatchId(match.id);
      document.getElementById('tournament-operations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setEditingMatch(match);
    setInputScore1(match.score1 ?? 18);
    setInputScore2(match.score2 ?? 14);
    setOverrideTeam1Id(match.team1?.id || '');
    setOverrideTeam2Id(match.team2?.id || '');
    setOverrideCourt(match.courtName || 'Quadra 1 - Central');
    setOverrideTime(match.scheduledTime || '14:00');
  };

  const handleSaveFullEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    const newT1 = pairsInTourn.find((p) => p.id === overrideTeam1Id);
    const newT2 = pairsInTourn.find((p) => p.id === overrideTeam2Id);

    try {
      handleOverrideMatch(editingMatch.id, { team1: newT1, team2: newT2, courtName: overrideCourt, scheduledTime: overrideTime });
      triggerToast('Participantes e agenda atualizados. Para registrar sets, use Administrar tabela.');
    } catch (error) { triggerToast(error instanceof Error ? error.message : 'Falha ao editar partida.'); return; }

    setEditingMatch(null);
  };

  const handleSwitchSemiFormat = (newFormat: SemiFormat) => {
    updateTournamentConfig(activeTournament.id, { semiFormat: newFormat });
    triggerToast(
      newFormat === 'semi_direta'
        ? 'Formato alterado para Semifinal Direta (Padrão Futevôlei: Semifinais + Grande Final + DISPUTA DE 3º)!'
        : 'Formato alterado para Semi com Chance (Padrão Challonge: perdedor da semi cai pra repescagem)!'
    );
  };

  const renderMatchCard = (match: BracketMatch) => {
    const isCompleted = match.status === 'completed';
    const isLive =
      match.status === 'in_progress' ||
      (!isCompleted && Boolean(match.liveReferee) && ((match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0));
    const isReady = !!match.team1 && !!match.team2;

    const team1Won = isCompleted && match.winnerId === match.team1?.id;
    const team2Won = isCompleted && match.winnerId === match.team2?.id;

    const liveS1 = parseInt(getInlineScore(match, 's1'), 10) || (match.score1 ?? 0);
    const liveS2 = parseInt(getInlineScore(match, 's2'), 10) || (match.score2 ?? 0);
    const nearEndEval = evaluateMatchNearCompletion(match, currentMatches, liveS1, liveS2, 18);

    const currentServerName =
      match.liveReferee?.serviceOrderLabels?.[match.liveReferee.serverRotationIndex];

    let routingNote = '';
    if (match.stage === 'winners') {
      routingNote = match.nextMatchLoserId ? 'Perdedor cai p/ Repescagem' : 'Vencedor avança';
    } else if (match.stage === 'losers') {
      routingNote = 'Perdedor eliminado (2ª derrota)';
    } else if (match.stage === 'semifinals') {
      routingNote = 'Vencedor vai à Final · Perdedor disputa 3º Lugar';
    } else if (match.stage === 'third_place') {
      routingNote = 'Valendo o 3º Lugar do Pódio';
    } else {
      routingNote = 'Valendo o Título Geral';
    }

    // Green for Winners Bracket, Yellow/Amber for Losers Bracket, Sharkset Blue for Semis/Final/3rd Place
    const isWinnersStage = match.stage === 'winners';
    const isLosersStage =
      match.stage === 'losers' && !match.stageName.toLowerCase().includes('3º lugar');

    const cardToneClasses = `${
      isWinnersStage
        ? 'bracket-card-winners'
        : isLosersStage
        ? 'bracket-card-losers'
        : 'bracket-card-central'
    } ${isLive ? 'bracket-card-live' : ''}`;

    return (
      <div
        key={match.id}
        data-match-id={match.id}
        data-winner-id={match.winnerId || ''}
        onClick={() => setSelectedLiveMatchId(match.id)}
        className={`bracket-match-node rounded-2xl p-3.5 transition-all shadow-md text-[#F7FAFD] cursor-pointer group ${cardToneClasses}`}
      >
        <div className="flex items-center justify-between text-xs text-slate-200 pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`px-2 py-0.5 rounded font-black text-[10px] uppercase shrink-0 ${
                isWinnersStage
                  ? 'bg-emerald-400 text-slate-950'
                  : isLosersStage
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#0987CE] text-white'
              }`}
            >
              Jogo {match.matchNumber}
            </span>
            {match.stage !== 'winners' && match.stage !== 'losers' && <span className="font-black text-xs">{matchPhaseLabel(match)}</span>}
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase shrink-0 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="w-2 h-2 rounded-full bg-white -ml-3.5" />
                AO VIVO
              </span>
            )}
            <span className="text-[11px] text-white/85 truncate">
              {match.courtName || 'Quadra 1'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isReady && !isCompleted && (
              <button
                type="button"
                onClick={() => handleToggleLiveMatch(match)}
                className={`px-2 py-0.5 rounded-lg font-extrabold text-[10px] flex items-center gap-1 transition-colors cursor-pointer ${
                  isLive
                    ? 'bg-red-600 text-white'
                    : 'bg-black/30 hover:bg-red-600/80 text-white'
                }`}
                title="Ativar ou desativar destaque de Jogo Ao Vivo (borda vermelha)"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-ping' : 'bg-red-400'}`} />
                Ao Vivo
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedLiveMatchId(match.id)}
              className="px-2 py-0.5 rounded-lg bg-black/30 hover:bg-black/45 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Abrir página da partida em tempo real (Chat, Saque, Juiz, Histórico de Pontos)"
            >
              <Eye className="w-3 h-3 text-[#12C7BB]" />
              Detalhes
            </button>
            {isReady && (
              <button
                type="button"
                onClick={() => setRefereeModalMatchId(match.id)}
                className="px-2 py-0.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                title="Abrir Tela do Árbitro (computar pontos, ordem de saque, pedidos de tempo)"
              >
                <ShieldAlert className="w-3 h-3" />
                Juiz
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenMatchEditor(match)}
              className="p-1 text-slate-200 hover:text-white rounded cursor-pointer"
              title="Editar participantes, horário ou placar livremente"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setReportMatchTarget({
                  id: match.id,
                  name: `Jogo #${match.matchNumber} (${formatParticipantName(match.team1)} vs ${formatParticipantName(match.team2)})`,
                })
              }
              className="p-1 text-red-400 hover:text-red-300 rounded cursor-pointer hover:bg-red-950/40"
              title="Denunciar suspeita de fraude, conluio ou entrega de pontos nesta partida"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time Referee & Server Info Bar inside Match Card */}
        <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-[#030B17]/90 border border-[#145A9B]/60 text-white text-[10px] flex items-center justify-between gap-2">
          <span className="truncate font-bold text-[#12C7BB]">
            🏐 {currentServerName ? `Sacando: ${currentServerName}` : `Juiz: ${match.liveReferee?.refereeName || 'Oficial SHARK SET'}`}
          </span>
          <span className="text-[10px] text-[#5BC3FA] font-bold shrink-0">
            Chat & Lances →
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.stopPropagation();
            handleInlineSubmit(match, e);
          }}
          className="space-y-1.5"
        >
          {/* Team 1 */}
          <div
            data-slot-winner={team1Won ? 'true' : 'false'}
            className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
              team1Won
                ? 'bg-[#0987CE]/25 font-bold text-white border border-[#12C7BB]'
                : 'bg-[#030B17] text-slate-200 border border-[#145A9B]/60'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate pr-2 flex-1">
              <span className="text-[10px] text-[#5BC3FA] font-mono shrink-0">
                {match.team1 ? `#${match.team1.seed}` : '—'}
              </span>
              <span className="truncate font-bold">
                {formatParticipantName(match.team1)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {team1Won && <Trophy className="w-3 h-3 text-[#12C7BB] shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's1')}
                onChange={(e) => handleInlineScoreChange(match, 's1', e.target.value)}
                className="w-12 h-7 text-center font-mono font-bold text-xs bg-[#071D3D] text-white border border-[#145A9B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE] tabular-nums"
              />
            </div>
          </div>

          {/* Team 2 */}
          <div
            data-slot-winner={team2Won ? 'true' : 'false'}
            className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
              team2Won
                ? 'bg-[#0987CE]/25 font-bold text-white border border-[#12C7BB]'
                : 'bg-[#030B17] text-slate-200 border border-[#145A9B]/60'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate pr-2 flex-1">
              <span className="text-[10px] text-[#5BC3FA] font-mono shrink-0">
                {match.team2 ? `#${match.team2.seed}` : '—'}
              </span>
              <span className="truncate font-bold">
                {formatParticipantName(match.team2)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {team2Won && <Trophy className="w-3 h-3 text-[#12C7BB] shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's2')}
                onChange={(e) => handleInlineScoreChange(match, 's2', e.target.value)}
                className="w-12 h-7 text-center font-mono font-bold text-xs bg-[#071D3D] text-white border border-[#145A9B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE] tabular-nums"
              />
            </div>
          </div>

          {/* 1-Click Alert for Next Match Players when <= 10 points left */}
          {!isCompleted && isReady && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const msg = notifyLiveMatchProgress(match.id, liveS1 || 10, liveS2 || 8);
                if (msg) triggerToast(`🔔 Push enviado! ${msg}`);
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#0987CE]/60 text-[#5BC3FA] font-extrabold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
              title="Notificar jogadores do próximo jogo que faltam <= 10 pontos para acabar"
            >
              <span className="flex items-center gap-1">
                <BellRing className="w-3 h-3 text-[#12C7BB]" />
                Faltam {nearEndEval.pointsRemaining || 8} pts p/ acabar
              </span>
              <span className="underline">Notificar Próximo Jogo</span>
            </button>
          )}

          <div
            className="pt-2 flex items-center justify-between text-[11px]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-slate-300 truncate max-w-[140px]" title={routingNote}>
              {routingNote}
            </span>

            <div className="flex items-center gap-1">
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => handleOpenMatchHistory(match.team1, match.team2, match.id)}
                  className="px-2 py-1 rounded-lg bg-[#12C7BB]/20 hover:bg-[#12C7BB]/35 border border-[#12C7BB]/50 text-[#12C7BB] font-black text-[10px] cursor-pointer transition-colors"
                  title="Votar no MVP (Craque da Partida) no Firestore"
                >
                  🗳️ MVP
                </button>
              )}

              {isReady && (
                <a
                  href={generateMatchCallWhatsAppLink(match, activeTournament.name, tenant.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-[#12C7BB] hover:bg-[#030B17] rounded-lg transition-colors"
                  title="Chamar jogadores no WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
              )}

              {isReady && (
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0987CE] text-white hover:bg-[#0772b0] transition-colors cursor-pointer flex items-center gap-1"
                  title="Confirmar placar e animar caminho do vencedor (GSAP)"
                >
                  <Check className="w-3 h-3" />
                  {isCompleted ? 'Atualizar' : 'Confirmar'}
                </button>
              )}

              {isCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenMatchEditor(match);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Voltar atrás / desfazer resultado"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  };

  if (!activeTournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-6 text-white text-center">
        <div className="aquarium-glass rounded-3xl p-8 border border-cyan-500/30 max-w-xl mx-auto space-y-4">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-black">Nenhum Torneio Cadastrado</h2>
          <p className="text-sm text-slate-300">
            Você está operando em produção com o banco limpo! Crie o seu primeiro torneio oficial para gerar chaves, cadastrar duplas e acompanhar as partidas em tempo real.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#FF8800] text-white font-black text-base shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            + Criar Primeiro Torneio
          </button>
        </div>
        {showTournamentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 text-left">
            <div className="aquarium-glass bg-[#071D3D] text-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#145A9B] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSaveTournamentModal} className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#145A9B]/60">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#12C7BB]">
                      Gestão de Torneios de Futevôlei
                    </span>
                    <h3 className="text-base font-bold text-white">Criar Novo Torneio de Futevôlei</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTournamentModal(null)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome do Torneio:</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Copa Regional de Futevôlei Mineiros"
                    className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Data do Torneio:</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Local / Arena:</label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Ex: SHARK SET Arena Matriz - Mineiros/GO"
                      className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-white"
                    />
                  </div>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTournamentModal(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl cursor-pointer"
                  >
                    Criar Torneio Oficial
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? 'max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6'
          : 'max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6'
      }
    >
      {/* Toast Feedback */}
      {!minimalistPlayerView && activeTournament && (
        <PodiumCardStudio key={activeTournament.id} tournament={activeTournament} matches={currentMatches}
          arena={availableTenants.find(arena => arena.id === activeTournament.tenantId)} />
      )}
      {feedbackToast && (
        <div role="status" aria-live="polite" className="p-3.5 bg-emerald-950/70 text-emerald-50 border border-emerald-400/60 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-white p-1 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {!isFullscreen && <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2.5"><LocationScopeFilter /></div>}
      {!isFullscreen && scopedTournaments.length > 0 && (
        <section aria-label="Campeonatos disponíveis" className="space-y-2 rounded-2xl border border-[#145A9B]/70 bg-[#030B17]/85 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-white">Campeonatos</h2>
            <span className="text-[11px] text-slate-400">{scopedTournaments.length} disponíveis</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {scopedTournaments.map((tournament) => {
              const isSelected = tournament.id === activeTournament.id;
              const isBroadcastLive = liveBroadcastTournamentIds.has(tournament.id);
              return (
                <button
                  key={tournament.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setActiveTournamentId(tournament.id);
                    setManualKnockoutToggle(null);
                  }}
                  className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-cyan-300 bg-cyan-950/50' : 'border-slate-700 bg-slate-900/80 hover:border-cyan-500/70'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">{tournament.name}</span>
                    <span className="mt-1 block truncate text-[10px] text-slate-400">{tournament.date} · {tournament.location || 'Local a definir'}</span>
                  </span>
                  {isBroadcastLive && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-black text-white"><Radio className="h-3 w-3 animate-pulse" /> AO VIVO</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {/* Coastal Beach Stadium Hero Banner matching the User's Print */}
      {!isFullscreen && (
        <div className="aquarium-glass relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-slate-900">
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85"
            alt={activeTournament.name}
            className="w-full h-56 sm:h-64 object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8 flex flex-col md:flex-row md:items-end justify-between gap-4 text-white">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black uppercase tracking-wider text-[11px]">
                  {activeTournament.isOpenForRegistration ? 'INSCRIÇÕES ABERTAS' : 'EM ANDAMENTO'}
                </span>
                {liveBroadcastTournamentIds.has(activeTournament.id) && <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black text-white"><Radio className="h-3.5 w-3.5 animate-pulse" /> AO VIVO AGORA</span>}
                <span className="flex items-center gap-1 text-slate-200 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  {activeTournament.location || `${tenant.name} · ${tenant.city}/${tenant.state}`}
                </span>
                <span className="flex items-center gap-1 text-slate-200 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-orange-400" />
                  {activeTournament.date}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                {activeTournament.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowQuickEnrollModal(true)}
                className="px-5 py-2.5 rounded-full bg-[#FF6B00] hover:bg-[#EA580C] text-white font-black text-xs cursor-pointer shadow-md transition-all"
              >
                + Inscrever Dupla Agora
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Tela Cheia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ultra-Intuitive 3-Step Visual Guide (Hidden in Fullscreen Mode and Minimalist Player View) */}
      {!isFullscreen && !minimalistPlayerView && (
        <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-2xl p-4 sm:p-5 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-white">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded bg-[#0987CE] text-white font-black uppercase text-[10px]">
                FLUXO INTUITIVO SHARK SET · INSCRIÇÃO E CHAVEAMENTO
              </span>
              <span className="font-bold text-[#12C7BB]">
                {tournaments.length} campeonatos ativos em {availableTenants.length} arenas simultâneas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setShowQuickEnrollModal(true)}
                className="p-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-left transition-all cursor-pointer"
              >
                <span className="font-black text-[#12C7BB] block">PASSO 1 · Inscrever Dupla</span>
                <span className="text-[11px] text-slate-300">
                  Garanta a vaga na hora com validação de categoria do Ranking
                </span>
              </button>

              <button
                type="button"
                onClick={openStartDrawModal}
                className="p-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-left transition-all cursor-pointer"
              >
                <span className="font-black text-[#5BC3FA] block">PASSO 2 · Sortear ou Posicionar</span>
                <span className="text-[11px] text-slate-300">
                  Sorteio aleatório ou escolha manual das duplas presentes
                </span>
              </button>


            </div>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col gap-2 shrink-0 border-t xl:border-t-0 xl:border-l border-[#145A9B] pt-3 xl:pt-0 xl:pl-4">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expandir Tabela em Tela Cheia
            </button>
            <button
              type="button"
              onClick={() => {
                setArenaSubTab('aulas');
                setActiveTab('scheduler');
              }}
              className="px-4 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#5BC3FA] font-bold text-xs transition-all cursor-pointer text-center"
            >
              Ir para Agendamento, Aulas & Matrículas →
            </button>
          </div>
        </div>
      )}

      {/* Tournament Management Header — Clean Responsive Hierarchy (Never overflows horizontally) */}
      <div className="aquarium-glass bg-[#071D3D] text-[#F7FAFD] border-2 border-[#145A9B] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#0987CE] text-white font-black uppercase text-[10px]">
                  SHARK SET · {isSingles ? 'SIMPLES (1x1)' : 'DUPLAS (2x2)'}
                </span>
                <span className="font-extrabold text-[#12C7BB]">
                  {TOURNAMENT_CATEGORY_LABELS[activeTournament.category]}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-[#0987CE]" />
                  {activeTournament.date}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-[#0987CE]" />
                  {activeTournament.location || `${tenant.name} (${tenant.city})`}
                </span>
                <span className="font-extrabold text-[#12C7BB]">
                  Vagas: {activePairsInTourn.length}/{activeTournament.maxPairs} ({confirmedPairsCount} confirmadas)
                </span>
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <SharksetLogo size="sm" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {activeTournament.name}
                </h1>
              </div>
            </div>

            {/* Primary Tournament Selector & Fullscreen Toggle */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={activeTournamentId}
                onChange={(e) => {
                  setActiveTournamentId(e.target.value);
                  setManualKnockoutToggle(null);
                }}
                className="px-3 py-2 text-xs font-extrabold bg-[#030B17] text-white border border-[#145A9B] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0987CE] max-w-full sm:max-w-[280px]"
              >
                {!scopedTournaments.some(t => t.id === activeTournamentId) && <option value={activeTournamentId}>Atual: {activeTournament.name} (fora do filtro)</option>}
                  {scopedTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsFullscreen((f) => !f)}
                className="px-3.5 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    Sair da Tela Cheia
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    Tela Cheia
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Responsive Action Bar — Wraps cleanly on all screens */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#145A9B]/60">
            <button
              onClick={openStartDrawModal}
              className="px-3.5 py-2 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Iniciar / Sortear ({presentPairsInTourn.length} Presentes)
            </button>

            <button
              onClick={() => setShowQuickEnrollModal(true)}
              className="px-3.5 py-2 text-xs font-black text-slate-950 bg-[#12C7BB] hover:brightness-110 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              Inscrever {isSingles ? 'Jogador' : 'Dupla'}
            </button>

            <button
              type="button"
              onClick={() =>
                setManualKnockoutToggle((prev) =>
                  prev !== null ? !prev : !hasReachedSemifinalsAutomatically
                )
              }
              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                knockoutOnlyMode
                  ? 'bg-[#12C7BB] text-slate-950 border-[#12C7BB]'
                  : 'bg-[#030B17] text-[#12C7BB] border-[#12C7BB]/50 hover:bg-[#0B254E]'
              }`}
              title="Minimiza os jogos passados e mostra somente a tabela comum de mata-mata (Semifinais, Final e 3º Lugar)"
            >
              <Trophy className="w-3.5 h-3.5" />
              {knockoutOnlyMode
                ? 'Modo Mata-Mata Ativo (Ver Chave Completa)'
                : 'Fase Semifinal (Minimizar Jogos Passados)'}
            </button>

            {!minimalistPlayerView && !knockoutOnlyMode && (
              <button
                type="button"
                onClick={handleSimulateAdvanceToSemifinals}
                className="px-3 py-2 text-xs font-bold text-[#5BC3FA] bg-[#030B17] hover:bg-[#0B254E] border border-[#0987CE]/50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                title="Avança automaticamente os jogos classificatórios para demonstrar a tabela na Semifinal com jogos passados minimizados"
              >
                <Zap className="w-3.5 h-3.5 text-[#12C7BB]" />
                Simular Ida p/ Semifinal
              </button>
            )}

            <button
              onClick={() => handleOpenShare()}
              className="px-3 py-2 text-xs font-bold text-white bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-[#0987CE]" />
              Compartilhar
            </button>

            <button
              onClick={() => handleOpenMatchHistory()}
              className="px-3 py-2 text-xs font-bold text-[#12C7BB] bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5 text-[#12C7BB]" />
              Histórico & MVP
            </button>

            <button
              onClick={openEditModal}
              className="px-3 py-2 text-xs font-bold text-slate-200 bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0987CE]" />
              Regras
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3 py-2 text-xs font-bold text-white bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#0987CE]" />
              PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-bold text-white bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#12C7BB]" />
              CSV
            </button>

            <button
              onClick={handlePrintBracket}
              className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              Imprimir
            </button>

            {!minimalistPlayerView && (
              <button
                onClick={openCreateModal}
                className="px-3 py-2 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Novo Torneio
              </button>
            )}
          </div>
        </div>

        {!minimalistPlayerView && (
          currentMatches.length > 0 && currentMatches.every(match => match.source1) ? (
            <div id="tournament-operations"><TournamentOperationsPanel matches={currentMatches} teams={pairsInTourn} focusedMatchId={operationsMatchId}
              onApply={(matches, teams) => { applyTournamentEdit(activeTournament.id, matches, teams); triggerToast('Tabela atualizada. Histórico preservado.'); }} /></div>
          ) : <p className="p-4 border border-amber-400 rounded-xl">Esta tabela usa o motor antigo ou ainda não foi gerada. Use o sorteio para gerar uma nova versão conforme o regulamento. A versão anterior será arquivada localmente.</p>
        )}

        {/* Podium Highlight */}
        {podium.champion && (
          <div className="pt-4 border-t border-[#145A9B] bg-gradient-to-r from-[#030B17] via-[#0B254E] to-[#030B17] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#12C7BB]/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#12C7BB] text-slate-950 flex items-center justify-center font-bold">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#12C7BB] uppercase tracking-wider block">
                  Pódio registrado na tabela
                </span>
                <span className="text-base font-extrabold text-white">
                  🥇 1º Lugar: {formatParticipantName(podium.champion)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              {podium.runnerUp && (
                <div>
                  <span className="text-slate-400 block">🥈 2º Lugar (Vice):</span>
                  <span className="font-bold text-white">
                    {formatParticipantName(podium.runnerUp)}
                  </span>
                </div>
              )}
              {podium.thirdPlace && (
                <div>
                  <span className="text-slate-400 block">🥉 3º Lugar:</span>
                  <span className="font-bold text-[#12C7BB]">
                    {formatParticipantName(podium.thirdPlace)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dual View Mode Switcher + Stage Filter */}
      <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-3.5 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-300 uppercase tracking-wider px-2">
            Modo de Visualização:
          </span>
          <div className="flex items-center gap-1.5 bg-[#030B17] p-1.5 rounded-xl border border-[#145A9B]">
            <button
              type="button"
              onClick={() => setBracketViewMode('chaveamento')}
              className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                bracketViewMode === 'chaveamento'
                  ? 'bg-[#0987CE] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
              }`}
            >
              🏆 1. Em Chaveamento (Pan, Zoom & Tela Cheia)
            </button>
            <button
              type="button"
              onClick={() => setBracketViewMode('lista')}
              className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                bracketViewMode === 'lista'
                  ? 'bg-[#0987CE] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
              }`}
            >
              📋 2. Em Lista (Por Fase / Rodada)
            </button>
          </div>
        </div>

        {/* Stage & Standings Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-[#030B17] p-1 rounded-xl border border-[#145A9B] w-fit">
          <button
            onClick={() => setActiveStageTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'all'
                ? 'bg-[#0987CE] text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
            }`}
          >
            Tabela Completa
          </button>
          <button
            onClick={() => setActiveStageTab('standings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'standings'
                ? 'bg-[#0987CE] text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
            }`}
          >
            📊 Classificação ({standings.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('winners');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'winners'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            Vencedores ({winnersMatches.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('losers');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'losers'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-amber-300 hover:text-white hover:bg-amber-950/60'
            }`}
          >
            Perdedores ({losersMatches.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('final');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'final'
                ? 'bg-[#0987CE] text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
            }`}
          >
            Semis, 3º & Final
          </button>

          <button
            type="button"
            onClick={() => {
              const completed = currentMatches.filter((m) => m.status === 'completed' && m.winnerId);
              const targetMatch = completed[completed.length - 1] || currentMatches[0];
              const winPair =
                targetMatch?.winnerId === targetMatch?.team2?.id
                  ? targetMatch?.team2
                  : targetMatch?.team1 || activePairsInTourn[0];
              if (winPair && targetMatch) {
                triggerGsapWinningPathAnimation(winPair, targetMatch);
              }
            }}
            className="px-3 py-1.5 text-xs font-black rounded-lg bg-gradient-to-r from-[#0987CE] to-[#12C7BB] text-slate-950 hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Animar com GSAP o caminho da dupla vencedora na chave"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Animar Caminho GSAP
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* GSAP WINNING TEAM PATH BANNER & POST-MATCH MVP VOTING CALLOUT         */}
      {/* ===================================================================== */}
      {activePathHighlight && (
        <div className="gsap-path-banner bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0B254E] border-2 border-[#12C7BB] rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#12C7BB] text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                TRAJETÓRIA DO VENCEDOR · ANIMAÇÃO GSAP
              </span>
              <span className="text-xs font-black text-white">
                🦈 {formatParticipantName(activePathHighlight.winner)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activePathHighlight.matchSteps.map((step, idx) => (
                <React.Fragment key={step.matchId}>
                  <span
                    className={`gsap-step-pill px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 border ${
                      step.isDestination
                        ? 'bg-[#0987CE]/25 border-[#0987CE] text-[#5BC3FA]'
                        : 'bg-[#12C7BB]/20 border-[#12C7BB] text-white'
                    }`}
                  >
                    {step.isDestination ? '🎯 Próximo: ' : '✅ Venceu '}
                    Jogo #{step.matchNumber} ({step.stageName})
                  </span>
                  {idx < activePathHighlight.matchSteps.length - 1 && (
                    <span className="text-[#12C7BB] font-black text-xs">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleOpenMatchHistory(
                  activePathHighlight.completedMatch.team1,
                  activePathHighlight.completedMatch.team2,
                  activePathHighlight.completedMatch.id
                )
              }
              className="px-3.5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Award className="w-4 h-4 text-[#12C7BB]" />
              🗳️ Votar MVP do Jogo #{activePathHighlight.completedMatch.matchNumber}
            </button>
            <button
              type="button"
              onClick={() =>
                triggerGsapWinningPathAnimation(
                  activePathHighlight.winner,
                  activePathHighlight.completedMatch
                )
              }
              className="px-3 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#12C7BB] font-bold text-xs cursor-pointer"
            >
              Repetir GSAP
            </button>
            <button
              type="button"
              onClick={() => setActivePathHighlight(null)}
              className="px-2.5 py-2 rounded-xl bg-[#030B17] text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISUALIZAÇÃO 1: CHAVEAMENTO OFICIAL DE FUTEVÔLEI COM INFINITY SCROLL   */}
      {/* ===================================================================== */}
      {activeStageTab !== 'standings' && bracketViewMode === 'chaveamento' && (
        <FutevoleiVisualBracketCanvas
          matches={currentMatches}
          semiFormat={activeTournament.semiFormat}
          isSingles={isSingles}
          formatParticipantName={formatParticipantName}
          getInlineScore={getInlineScore}
          onInlineScoreChange={handleInlineScoreChange}
          onInlineSubmit={handleInlineSubmit}
          onOpenRefereeModal={(mId) => {
            const match = currentMatches.find(item => item.id === mId);
            if (match && (match.status === 'completed' || match.rules && match.rules.bestOf > 1)) handleOpenMatchEditor(match);
            else setRefereeModalMatchId(mId);
          }}
          onOpenMatchEditor={handleOpenMatchEditor}
          onSelectMatchCard={(m) => setSelectedLiveMatchId(m.id)}
          onShareMatch={(m) => handleOpenShare(m)}
          onHistoryMatch={(m) => handleOpenMatchHistory(m.team1, m.team2, m.id)}
          onToggleLiveMatch={handleToggleLiveMatch}
          onQuickOfficialize={handleQuickOfficialize}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((f) => !f)}
          onNavigateToTournamentOrBroadcast={() => {
            setIsFullscreen(false);
            const targetMatch = liveMatches[0] || currentMatches.find((m) => m.linkedBroadcastId) || currentMatches[0];
            if (targetMatch && (targetMatch.status === 'in_progress' || targetMatch.linkedBroadcastId)) {
              useBroadcastNavigation.getState().open({
                kind: 'match',
                id: targetMatch.id,
                tournamentId: activeTournament.id,
              });
            } else {
              setActiveTab('live');
            }
          }}
          navigateActionLabel="Ir p/ Torneio / Transmissão"
          knockoutOnlyMode={knockoutOnlyMode}
          onToggleKnockoutOnlyMode={() =>
            setManualKnockoutToggle((prev) =>
              prev !== null ? !prev : !hasReachedSemifinalsAutomatically
            )
          }
        />
      )}

      {/* ===================================================================== */}
      {/* TABELA DE CLASSIFICAÇÃO AUTOMÁTICA DO TORNEIO                         */}
      {/* ===================================================================== */}
      {(activeStageTab === 'all' || activeStageTab === 'standings') && (
        <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-6 shadow-xl space-y-4 text-[#F7FAFD]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#145A9B]/60">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0987CE]" />
                Classificação Automática do Torneio (Tempo Real)
              </h2>
              <p className="text-xs text-slate-300">
                Gerada automaticamente conforme os resultados dos jogos são inseridos nas partidas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-[#12C7BB] font-semibold mr-2">
                {currentMatches.filter((m) => m.status === 'completed').length} de {currentMatches.length} jogos concluídos
              </span>
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-3 py-1.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg bg-[#030B17] hover:bg-[#0B254E] text-slate-200 font-bold text-xs border border-[#145A9B] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#12C7BB]" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={handlePrintBracket}
                className="px-3 py-1.5 rounded-lg bg-[#030B17] hover:bg-[#0B254E] text-slate-300 hover:text-white font-bold text-xs border border-[#145A9B] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#145A9B]/60 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Pos</th>
                  <th className="py-2.5 px-3">{isSingles ? 'Jogador (Simples)' : 'Dupla Participante'}</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-center">J</th>
                  <th className="py-2.5 px-3 text-center">V</th>
                  <th className="py-2.5 px-3 text-center">D</th>
                  <th className="py-2.5 px-3 text-center">Pró / Contra</th>
                  <th className="py-2.5 px-3 text-center">Saldo</th>
                  <th className="py-2.5 px-3 text-center">Aprov.</th>
                  <th className="py-2.5 px-3 text-right">Pts Ranking Ganhos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#145A9B]/40">
                {standings.map((row) => (
                  <tr key={row.pair.id} className="hover:bg-[#0B254E]/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-extrabold text-[#0987CE]">
                      {row.position}º
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block">
                        {formatParticipantName(row.pair)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Seed #{row.pair.seed} · {ATHLETE_LEVEL_LABELS[row.pair.player1Level]}
                        {!isSingles ? ` + ${ATHLETE_LEVEL_LABELS[row.pair.player2Level]}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-bold text-[11px] ${
                          row.statusBadge.includes('Campeão')
                            ? 'text-[#12C7BB] font-black'
                            : row.statusBadge === 'Invicto'
                            ? 'text-emerald-400'
                            : row.statusBadge.includes('Eliminado')
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {row.statusBadge}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-200">{row.matchesPlayed}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">{row.wins}</td>
                    <td className="py-3 px-3 text-center font-mono text-rose-400">{row.losses}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {row.pointsFor} : {row.pointsAgainst}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-white">
                      {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-200">{row.winRate}%</td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                      +{row.rankingPointsEarned} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISUALIZAÇÃO 2: EM LISTA (CARDS POR FASE / RODADA) */}
      {activeStageTab !== 'standings' && bracketViewMode === 'lista' && (
        <div className="space-y-8">
          {/* SECTION 1: CHAVE DOS VENCEDORES (FUNDO VERDE) */}
          {(activeStageTab === 'all' || activeStageTab === 'winners') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Chave dos Vencedores (Fundo Verde)
                </h2>
                <span className="text-xs text-slate-400">
                  Clique em qualquer cartão para abrir o jogo em tempo real com chat e histórico de pontos
                </span>
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-2 ${
                  activeTournament.semiFormat === 'semi_com_chance' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
                } gap-4`}
              >
                <div className="space-y-3">
                  <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide px-1">
                    Rodada 1: Quartas de Final (J1 a J4)
                  </div>
                  {winnersMatches.filter((m) => m.round === 1).map((m) => renderMatchCard(m))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide px-1">
                    {activeTournament.semiFormat === 'semi_direta'
                      ? 'Rodada 2: Vale Vaga Direta na Semifinal (J7 e J8)'
                      : 'Rodada 2: Semifinal Vencedores (J7 e J8)'}
                  </div>
                  {winnersMatches.filter((m) => m.round === 2).map((m) => renderMatchCard(m))}
                </div>

                {activeTournament.semiFormat === 'semi_com_chance' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide px-1">
                      Rodada 3: Final dos Vencedores (J11)
                    </div>
                    {winnersMatches.filter((m) => m.round === 3).map((m) => renderMatchCard(m))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: CHAVE DOS PERDEDORES (FUNDO AMARELO) */}
          {(activeStageTab === 'all' || activeStageTab === 'losers') && (
            <div className="space-y-3 pt-4 border-t border-[#145A9B]/60">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  Chave dos Perdedores / Repescagem (Fundo Amarelo)
                </h2>
                <span className="text-xs text-slate-400">Quem perde 2 vezes está eliminado</span>
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-2 ${
                  activeTournament.semiFormat === 'semi_com_chance' ? 'lg:grid-cols-4' : 'lg:grid-cols-2'
                } gap-4`}
              >
                <div className="space-y-3">
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wide px-1">
                    Repescagem R1 (Perdedores da R1 - J5 e J6)
                  </div>
                  {losersMatches.filter((m) => m.round === 1).map((m) => renderMatchCard(m))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wide px-1">
                    {activeTournament.semiFormat === 'semi_direta'
                      ? 'Repescagem R2: Vale Vaga na Semifinal Direta (J9 e J10)'
                      : 'Repescagem R2: Cruzamento c/ Perdedores da Semi (J9 e J10)'}
                  </div>
                  {losersMatches.filter((m) => m.round === 2).map((m) => renderMatchCard(m))}
                </div>

                {activeTournament.semiFormat === 'semi_com_chance' && (
                  <>
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-amber-300 uppercase tracking-wide px-1">
                        Repescagem R3: Semifinal Perdedores (J12)
                      </div>
                      {losersMatches.filter((m) => m.round === 3).map((m) => renderMatchCard(m))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-bold text-amber-300 uppercase tracking-wide px-1">
                        Repescagem R4: Final Perdedores (J13)
                      </div>
                      {losersMatches.filter((m) => m.round === 4).map((m) => renderMatchCard(m))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: FASE FINAL (SEMIFINAIS, GRANDE FINAL E DISPUTA DE 3º LUGAR) */}
          {(activeStageTab === 'all' || activeStageTab === 'final') && (
            <div className="space-y-4 pt-4 border-t border-[#145A9B]/60">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#5BC3FA] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#12C7BB]" />
                  {activeTournament.semiFormat === 'semi_direta'
                    ? 'Mata-Mata Final: Semifinais, Grande Final & DISPUTA DE 3º'
                    : 'Grande Final (Campeão Vencedores vs Campeão Repescagem)'}
                </h2>
              </div>

              {activeTournament.semiFormat === 'semi_direta' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-[#5BC3FA] uppercase tracking-wide px-1">
                      SEMI FINAL
                    </div>
                    {semiMatches.map((m) => renderMatchCard(m))}
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-[#12C7BB] uppercase tracking-wide px-1">
                      🏆 FINAL
                    </div>
                    {grandFinalMatches.map((m) => renderMatchCard(m))}
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wide px-1">
                      🥉 DISPUTA DE 3º
                    </div>
                    {thirdPlaceMatches.map((m) => renderMatchCard(m))}
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  {grandFinalMatches.map((m) => renderMatchCard(m))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL A: CREATE OR EDIT TOURNAMENT                                    */}
      {/* ===================================================================== */}
      {showTournamentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="aquarium-glass bg-[#071D3D] text-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#145A9B] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveTournamentModal} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#145A9B]/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#12C7BB]">
                    Gestão de Torneios de Futevôlei
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {showTournamentModal === 'create'
                      ? 'Criar Novo Torneio de Futevôlei'
                      : 'Gerenciar & Editar Configurações do Torneio'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTournamentModal(null)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Scope & Token Selector for Tournament Creation */}
              {showTournamentModal === 'create' && (
                <div className="p-3.5 rounded-xl bg-[#031527] border border-[#145A9B] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#12C7BB] flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      Modo de Criação & Economia de Tokens
                    </span>
                    <span className="text-xs font-bold text-amber-300 font-mono bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-600/40">
                      Saldo: {userProfile.tournamentTokens ?? 0} Token(s) 🪙
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormScope('arena')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formScope === 'arena'
                          ? 'border-[#12C7BB] bg-[#12C7BB]/15 text-white shadow-md'
                          : 'border-[#145A9B]/60 bg-[#030B17] text-slate-300 hover:border-[#145A9B]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-[#12C7BB]" />
                        <span className="font-bold text-xs">Torneio da Arena</span>
                      </div>
                      <span className="text-[11px] text-slate-300 block">
                        Fixo na {tenant.name}. Sem custo de tokens (Incluso no plano da Arena).
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormScope('user')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formScope === 'user'
                          ? 'border-amber-400 bg-amber-500/15 text-white shadow-md'
                          : 'border-[#145A9B]/60 bg-[#030B17] text-slate-300 hover:border-[#145A9B]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-xs">Organizador Independente</span>
                      </div>
                      <span className="text-[11px] text-slate-300 block">
                        Custa 1 Token de Campeonato. Escolha qualquer arena cadastrada no app.
                      </span>
                    </button>
                  </div>

                  {/* Independent Organizer: Choose any Arena */}
                  {formScope === 'user' && (
                    <div className="space-y-2 pt-1 border-t border-[#145A9B]/60">
                      <label className="block font-semibold text-slate-300">
                        Selecione a Arena Sede do Torneio:
                      </label>
                      <select
                        value={formTenantId}
                        onChange={(e) => {
                          setFormTenantId(e.target.value);
                          const chosen = availableTenants.find((a) => a.id === e.target.value);
                          if (chosen) {
                            setFormLocation(`${chosen.name} - ${chosen.city}/${chosen.state}`);
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-white font-semibold"
                      >
                        {availableTenants.map((arena) => (
                          <option key={arena.id} value={arena.id}>
                            {arena.name} ({arena.city} - {arena.state})
                          </option>
                        ))}
                      </select>

                      {/* Token Pack Purchase Quick Panel */}
                      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Comprar Tokens de Torneio (Atleta / Organizador)
                          </span>
                          <span className="text-[10px] text-slate-400">Uso gradual</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await buyTournamentTokens(1);
                              toast.success('1 Token de Campeonato adicionado com sucesso!');
                            }}
                            className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-center transition-all cursor-pointer"
                          >
                            <span className="block font-extrabold text-amber-300 text-xs">+1 Token</span>
                            <span className="block text-[10px] text-slate-300">R$ 20</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await buyTournamentTokens(5);
                              toast.success('Pacote de 5 Tokens de Campeonato adicionado!');
                            }}
                            className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-center transition-all cursor-pointer"
                          >
                            <span className="block font-extrabold text-amber-300 text-xs">+5 Tokens</span>
                            <span className="block text-[10px] text-slate-300">R$ 85 (-15%)</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await buyTournamentTokens(10);
                              toast.success('Super Pacote de 10 Tokens de Campeonato adicionado!');
                            }}
                            className="p-2 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 border border-amber-400 text-center transition-all cursor-pointer ring-1 ring-amber-400/50"
                          >
                            <span className="block font-extrabold text-amber-300 text-xs">+10 Tokens</span>
                            <span className="block text-[10px] text-emerald-300 font-bold">R$ 150 (-25%)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Arena Scope: Fixed Arena indicator */}
                  {formScope === 'arena' && (
                    <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-700/50 text-cyan-200 text-xs flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0 text-[#12C7BB]" />
                      <span>
                        Arena vinculada: <strong>{tenant.name}</strong> ({tenant.city} - {tenant.state}). Não consome tokens de usuário.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Torneio:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Copa Regional de Futevôlei Mineiros"
                  className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data do Torneio:</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Local / Arena:</label>
                  <input
                    type="text"
                    required
                    readOnly={showTournamentModal === 'create' && formScope === 'arena'}
                    value={
                      showTournamentModal === 'create' && formScope === 'arena'
                        ? `${tenant.name} (${tenant.city} - ${tenant.state})`
                        : formLocation
                    }
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ex: SHARK SET Arena Matriz - Mineiros/GO"
                    className={`w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-white ${
                      showTournamentModal === 'create' && formScope === 'arena'
                        ? 'opacity-80 cursor-not-allowed'
                        : ''
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Formato de Participação (Simples vs Duplas):
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormModality('duplas')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formModality === 'duplas'
                        ? 'border-[#0987CE] bg-[#0987CE]/25 text-white'
                        : 'border-[#145A9B] bg-[#030B17] text-slate-300'
                    }`}
                  >
                    <span className="font-bold block">Duplas (2x2 Tradicional)</span>
                    <span className="text-[11px] opacity-80 block">
                      Validação de equilíbrio de pareamento entre os 2 parceiros.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormModality('simples')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formModality === 'simples'
                        ? 'border-[#0987CE] bg-[#0987CE]/25 text-white'
                        : 'border-[#145A9B] bg-[#030B17] text-slate-300'
                    }`}
                  >
                    <span className="font-bold block">Simples (1x1 / Desafio Individual)</span>
                    <span className="text-[11px] opacity-80 block">
                      Inscrição individual por jogador com pontuação direta no Ranking.
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Categoria / Série:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TournamentCategory)}
                    className="w-full px-2.5 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg font-semibold text-white"
                  >
                    {Object.entries(TOURNAMENT_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Limite de Participantes:</label>
                  <input type="number" min={4} max={1024} step={1} value={formMaxParticipants}
                    onChange={event => setFormMaxParticipants(Number(event.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg" />
                  <p className="text-xs mt-1">Qualquer quantidade inteira entre 4 e 1.024 duplas.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Taxa de Inscrição (R$):</label>
                  <input
                    type="number"
                    value={formFee}
                    onChange={(e) => setFormFee(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Regras Específicas do Torneio:
                </label>
                <textarea
                  rows={3}
                  value={formRules}
                  onChange={(e) => setFormRules(e.target.value)}
                  placeholder="Defina pontuação dos sets (ex: 18 pts), regras de saque, tempo técnico, critério de desempate..."
                  className="w-full p-3 bg-[#030B17] border border-[#145A9B] rounded-lg text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTournamentModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl cursor-pointer"
                >
                  {showTournamentModal === 'create' ? 'Criar Torneio Oficial' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL B: SISTEMA DE INSCRIÇÃO RÁPIDA NO TORNEIO (SIMPLES OU DUPLAS)   */}
      {/* ===================================================================== */}
      {showQuickEnrollModal && activeTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQuickEnrollModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="quick-enroll-title" className="aquarium-glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#145A9B] bg-[#071D3D] p-5 text-white shadow-2xl sm:p-6">
            <form onSubmit={handleQuickEnrollSubmit} className="space-y-4 text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-[#145A9B]/60 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#12C7BB]">Inscrição · {activePairsInTourn.length}/{activeTournament.maxPairs} vagas</span>
                  <h3 id="quick-enroll-title" className="mt-1 text-base font-bold">Inscrever {isSingles ? 'atleta' : 'dupla'} em {activeTournament.name}</h3>
                </div>
                <button type="button" aria-label="Fechar" onClick={() => setShowQuickEnrollModal(false)} className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10 hover:text-white">✕</button>
              </div>
              <AthleteEmailSelector label={isSingles ? 'Atleta' : 'Atleta 1'} athletes={athletes} selectedEmail={enrollP1} enrolledEmails={enrolledAthleteEmails} onSelectAthlete={(athlete) => setEnrollP1((athlete?.email || '').trim().toLowerCase())} />
              {!isSingles && <AthleteEmailSelector label="Atleta 2" athletes={athletes} selectedEmail={enrollP2} excludeEmail={enrollP1} enrolledEmails={enrolledAthleteEmails} onSelectAthlete={(athlete) => setEnrollP2((athlete?.email || '').trim().toLowerCase())} />}
              <div className={`rounded-xl border p-3 ${enrollValidation.isValid ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100' : 'border-rose-500/40 bg-rose-950/40 text-rose-100'}`}>
                <strong className="block">{enrollValidation.reason}</strong>
                <span className="mt-1 block text-[11px] opacity-80">{enrollValidation.ruleSummary}</span>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#145A9B]/60 pt-3">
                <button type="button" onClick={() => setShowQuickEnrollModal(false)} className="rounded-lg px-4 py-2 text-slate-300 hover:bg-white/10">Cancelar</button>
                <button type="submit" disabled={!enrollValidation.isValid || quickEnrollLock.current || activePairsInTourn.length >= activeTournament.maxPairs} className="rounded-xl bg-[#12C7BB] px-5 py-2.5 font-black text-slate-950 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">Confirmar inscrição</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Full Unfrozen Match Editor Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="aquarium-glass bg-[#071D3D] text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#145A9B] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#145A9B]/60">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#12C7BB]">
                  Edição Livre de Partida (Nada Congelado)
                </span>
                <h3 className="text-base font-bold text-white">
                  Jogo {editingMatch.matchNumber} · {matchPhaseLabel(editingMatch)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFullEditor} className="py-4 space-y-4 text-xs">
              <div className="p-3.5 bg-[#030B17] border border-[#145A9B] rounded-xl space-y-2">
                <label className="block font-bold text-slate-200">Lado 1 (Substituir ou manter):</label>
                <div className="flex items-center gap-2">
                  <select
                    value={overrideTeam1Id}
                    onChange={(e) => setOverrideTeam1Id(e.target.value)}
                    className="flex-1 px-2.5 py-2 bg-[#071D3D] border border-[#145A9B] rounded-lg font-semibold text-white"
                  >
                    <option value="">-- Aguardando / Vazio --</option>
                    {pairsInTourn.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.seed} - {formatParticipantName(p)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputScore1}
                    onChange={(e) => setInputScore1(parseInt(e.target.value, 10) || 0)}
                    className="w-20 px-2.5 py-2 text-center font-mono font-bold text-base bg-[#071D3D] border border-[#145A9B] rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[#030B17] border border-[#145A9B] rounded-xl space-y-2">
                <label className="block font-bold text-slate-200">Lado 2 (Substituir ou manter):</label>
                <div className="flex items-center gap-2">
                  <select
                    value={overrideTeam2Id}
                    onChange={(e) => setOverrideTeam2Id(e.target.value)}
                    className="flex-1 px-2.5 py-2 bg-[#071D3D] border border-[#145A9B] rounded-lg font-semibold text-white"
                  >
                    <option value="">-- Aguardando / Vazio --</option>
                    {pairsInTourn.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.seed} - {formatParticipantName(p)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputScore2}
                    onChange={(e) => setInputScore2(parseInt(e.target.value, 10) || 0)}
                    className="w-20 px-2.5 py-2 text-center font-mono font-bold text-base bg-[#071D3D] border border-[#145A9B] rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Quadra do Jogo:</label>
                  <input
                    type="text"
                    value={overrideCourt}
                    onChange={(e) => setOverrideCourt(e.target.value)}
                    className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Horário:</label>
                  <input
                    type="text"
                    value={overrideTime}
                    onChange={(e) => setOverrideTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#030B17] border border-[#145A9B] rounded-lg font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleResetMatch(editingMatch.id);
                    setEditingMatch(null);
                    triggerToast(`Partida ${editingMatch.matchNumber} resetada.`);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/50 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Zerar / Voltar Atrás
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMatch(null)}
                    className="px-3 py-2 text-xs font-medium text-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar & Atualizar Classificação
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Tournament & Dynamic Draw Builder Modal */}
      {showStartDrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="aquarium-glass bg-[#071D3D] text-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-[#145A9B] space-y-5 my-6">
            <div className="flex items-start justify-between border-b border-[#145A9B]/60 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#0987CE] text-white font-black uppercase text-[10px]">
                  INICIAR TORNEIO & GERAR TABELA OFICIAL
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  Tabela para Duplas Presentes ({presentPairsInTourn.length} presentes de {activePairsInTourn.length} ativas)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Confirme as duplas presentes na arena e escolha entre <strong>Seleção Aleatória (Sorteio)</strong> ou <strong>Colocar as Duplas Onde Quiser</strong> na chave.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartDrawModal(false)}
                className="text-slate-400 hover:text-white p-1.5 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Check-in de Presença e Pagamento dos 2 Jogadores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  1. Check-in de Presença e Status da Vaga (2 Pagamentos)
                </h4>
                <span className="text-[11px] font-bold text-[#12C7BB]">
                  {presentPairsInTourn.length} duplas marcadas como PRESENTES
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto border border-[#145A9B] rounded-2xl divide-y divide-[#145A9B]/40">
                {activePairsInTourn.map((pair) => {
                  const isPresent = pair.isPresent !== false;
                  const isConfirmed = pair.enrollmentStatus === 'confirmed';
                  return (
                    <div
                      key={pair.id}
                      className={`p-3 flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isPresent ? 'bg-[#030B17]' : 'bg-[#030B17]/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#5BC3FA]">#{pair.seed}</span>
                        <div>
                          <div className="font-extrabold text-white">
                            {pair.player1} & {pair.player2}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                isConfirmed ? 'text-[#12C7BB]' : 'text-[#5BC3FA]'
                              }`}
                            >
                              {isConfirmed ? '✓ Vaga Confirmada (2/2 Pagos)' : '⏳ Vaga Pendente'}
                            </span>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => togglePairPlayerPayment(pair.id, 1)}
                              className={`underline cursor-pointer ${
                                pair.player1Paid ? 'text-[#12C7BB] font-bold' : 'text-slate-300'
                              }`}
                            >
                              {pair.player1}: {pair.player1Paid ? 'Pago' : 'Pendente'}
                            </button>
                            <span>/</span>
                            <button
                              type="button"
                              onClick={() => togglePairPlayerPayment(pair.id, 2)}
                              className={`underline cursor-pointer ${
                                pair.player2Paid ? 'text-[#12C7BB] font-bold' : 'text-slate-300'
                              }`}
                            >
                              {pair.player2}: {pair.player2Paid ? 'Pago' : 'Pendente'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          togglePairPresence(pair.id);
                          setManualSlotOrder((prev) =>
                            isPresent ? prev.filter((id) => id !== pair.id) : [...prev, pair.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                          isPresent
                            ? 'bg-[#0987CE] text-white hover:bg-[#0772b0]'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {isPresent ? '✓ Presente no Torneio' : 'Ausente (Fora da Tabela)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Choose Random Draw vs Manual Placement */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                2. Como deseja posicionar as {presentPairsInTourn.length} duplas presentes na tabela?
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDrawMode('random')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    drawMode === 'random'
                      ? 'bg-[#030B17] text-white border-[#12C7BB] ring-2 ring-[#12C7BB]/40'
                      : 'bg-[#030B17]/60 text-slate-300 border-[#145A9B] hover:bg-[#030B17]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    <Shuffle className="w-4 h-4 text-[#12C7BB]" />
                    Seleção Aleatória (Sorteio)
                  </div>
                  <p className="text-xs mt-1 text-slate-300">
                    O sistema embaralha automaticamente todas as duplas presentes e monta os confrontos da 1ª rodada.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDrawMode('manual');
                    const presentIds = presentPairsInTourn.map((p) => p.id);
                    setManualSlotOrder((prev) => [
                      ...prev.filter((id) => presentIds.includes(id)),
                      ...presentIds.filter((id) => !prev.includes(id)),
                    ]);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    drawMode === 'manual'
                      ? 'bg-[#030B17] text-white border-[#12C7BB] ring-2 ring-[#12C7BB]/40'
                      : 'bg-[#030B17]/60 text-slate-300 border-[#145A9B] hover:bg-[#030B17]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    <Sliders className="w-4 h-4 text-[#12C7BB]" />
                    Colocar as Duplas Onde Quiser (Manual)
                  </div>
                  <p className="text-xs mt-1 text-slate-300">
                    Defina exatamente a posição de cada dupla nos confrontos da 1ª rodada antes de liberar os jogos.
                  </p>
                </button>
              </div>

              {drawMode === 'manual' && (
                <div className="aquarium-glass bg-[#030B17] border border-[#145A9B] rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-white">
                      Ordem Manual dos Confrontos (1ª Rodada):
                    </span>
                    <span className="text-slate-400">
                      Use as setas ↑ ↓ para colocar cada dupla no confronto desejado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {manualSlotOrder
                      .filter((id) => presentPairsInTourn.some((p) => p.id === id))
                      .map((pairId, idx, arr) => {
                        const pairObj = presentPairsInTourn.find((p) => p.id === pairId);
                        if (!pairObj) return null;
                        const matchNum = Math.floor(idx / 2) + 1;
                        const slotSide = idx % 2 === 0 ? 'Lado A' : 'Lado B';
                        return (
                          <div
                            key={pairObj.id}
                            className="bg-[#071D3D] border border-[#145A9B] rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="truncate">
                              <span className="px-1.5 py-0.5 rounded bg-[#0987CE] text-white font-black text-[10px] mr-1.5">
                                Jogo {matchNum} ({slotSide})
                              </span>
                              <span className="font-bold text-white">
                                {pairObj.player1} & {pairObj.player2}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveManualPair(idx, -1)}
                                className="p-1 rounded bg-[#030B17] hover:bg-[#0B254E] disabled:opacity-30 cursor-pointer"
                                title="Subir posição"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-[#5BC3FA]" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => moveManualPair(idx, 1)}
                                className="p-1 rounded bg-[#030B17] hover:bg-[#0B254E] disabled:opacity-30 cursor-pointer"
                                title="Descer posição"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-[#5BC3FA]" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#145A9B]/60 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300">
                Assim que o resultado de cada partida é confirmado, a próxima fase é populada automaticamente.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStartDrawModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-[#030B17] rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartTournamentDraw}
                  className="px-5 py-2.5 text-xs font-black text-white bg-[#0987CE] hover:bg-[#0772b0] rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Gerar Tabela p/ {presentPairsInTourn.length} Duplas Presentes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Spectator & Match Details Page Modal (Opened when clicking any match card) */}
      {selectedLiveMatch && (
        <MatchLiveDetailsModal
          match={selectedLiveMatch}
          tournamentName={activeTournament.name}
          arenaName={tenant.name}
          isSingles={isSingles}
          onClose={() => setSelectedLiveMatchId(null)}
          onUpdateLiveMatch={(matchId, updater) => {
            updateLiveRefereeMatch(matchId, updater);
          }}
          onConfirmFinalResult={(matchId, winningTeam, s1, s2) => {
            const winPair =
              winningTeam === 1 ? selectedLiveMatch.team1 : selectedLiveMatch.team2;
            try { handleAdvanceMatch(matchId, winningTeam, s1, s2); }
            catch (error) { triggerToast(error instanceof Error ? error.message : 'Confira os sets em Administrar tabela.'); return; }
            setSelectedLiveMatchId(null);
            if (winPair) {
              triggerGsapWinningPathAnimation(winPair, selectedLiveMatch);
            }
            toast.success(
              `Partida finalizada (${s1}x${s2})! Vencedor avançou e alertas WhatsApp emitidos.`
            );
          }}
          onOpenFullRefereeConsole={(mId) => {
            setSelectedLiveMatchId(null);
            setRefereeModalMatchId(mId);
          }}
          onOpenMvpAndHistory={(p1, p2, mId) => {
            setSelectedLiveMatchId(null);
            handleOpenMatchHistory(p1, p2, mId);
          }}
          onOpenShareMatch={(m) => {
            setSelectedLiveMatchId(null);
            handleOpenShare(m);
          }}
        />
      )}

      {/* Official Referee Console Modal (Points, Service Order, Timeouts, Court Swaps, Real-Time Broadcast) */}
      {activeRefereeMatch && (
        <RefereeConsoleModal
          match={activeRefereeMatch}
          arenaName={tenant.name}
          arenaId={tenant.id}
          tournamentMatches={tournamentMatches}
          onClose={() => setRefereeModalMatchId(null)}
          onUpdateLiveMatch={(matchId, updater) => {
            updateLiveRefereeMatch(matchId, updater);
          }}
          onConfirmFinalResult={(matchId, winningTeam, s1, s2) => {
            const winPair =
              winningTeam === 1 ? activeRefereeMatch.team1 : activeRefereeMatch.team2;
            try { handleAdvanceMatch(matchId, winningTeam, s1, s2); }
            catch (error) { triggerToast(error instanceof Error ? error.message : 'Confira os sets em Administrar tabela.'); return; }
            setRefereeModalMatchId(null);
            if (winPair) {
              triggerGsapWinningPathAnimation(winPair, activeRefereeMatch);
            }
            toast.success(
              `Partida finalizada pelo árbitro (${s1}x${s2})! Vencedor avançou e alertas WhatsApp emitidos.`
            );
          }}
          onNotify10PointsRemaining={(matchId, s1, s2) => {
            const msg = notifyLiveMatchProgress(matchId, s1, s2);
            if (msg) triggerToast(`🔔 Push enviado! ${msg}`);
          }}
        />
      )}

      {/* Share Bracket Modal (Deep Link, Social Summary, WhatsApp) */}
      <ShareBracketModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tournament={activeTournament}
        matches={currentMatches}
        selectedMatch={shareMatch}
        podium={podium}
        tenantName={tenant.name}
      />

      {/* Head-to-Head & Match History + Firestore MVP Voting Modal */}
      <MatchHistoryModal
        isOpen={showMatchHistoryModal}
        onClose={() => setShowMatchHistoryModal(false)}
        availablePairs={activePairsInTourn}
        initialPair1={historyPair1}
        initialPair2={historyPair2}
        tenantName={tenant.name}
        activeMatchId={activeHistoryMatchId}
        tournamentId={activeTournament.id}
        tournamentName={activeTournament.name}
      />

      {/* Integrity Report Modal (Denunciar Partida) */}
      {reportMatchTarget && (
        <IntegrityReportModal
          isOpen={!!reportMatchTarget}
          onClose={() => setReportMatchTarget(null)}
          targetType="match"
          targetId={reportMatchTarget.id}
          targetName={reportMatchTarget.name}
          onReportSubmitted={(rep) => {
            triggerToast(`🚨 Denúncia registrada: ${rep.targetName}. Enviada para o comitê de integridade.`);
          }}
        />
      )}
      {/* Seção Educativa: Como Funciona a Chave de Dupla Eliminação no SHARKSET */}
      <section className="rounded-3xl border border-cyan-800/40 bg-[#041529]/90 p-6 sm:p-8 text-white space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-cyan-800/50 pb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Como Funciona a Tabela de Dupla Eliminação</h3>
            <p className="text-xs text-slate-400">Entenda a chave dos vencedores, repescagem e avanço até a grande final.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Chave dos Vencedores (Winners)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Todas as duplas iniciam na chave principal (verde). Ao vencer, continuam avançando. Quem perde o primeiro jogo não é eliminado: cai imediatamente para a Repescagem (Losers).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Repescagem (Losers Bracket)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Na repescagem (amarela), a dupla luta pela sobrevida. Se vencer todos os jogos da repescagem, chega até a Semifinal/Final. Apenas a 2ª derrota elimina a dupla do campeonato.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-[#0987CE] font-black">
              <ShieldAlert className="w-4 h-4 text-cyan-300" />
              <span>Passaporte Único Anti-Gato</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              O nível do atleta no Sharkset é único e nacional. Se um jogador joga Série A ou B em sua cidade, o sistema bloqueia automaticamente a inscrição dele como Iniciante ou C em qualquer outra arena do Brasil.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
