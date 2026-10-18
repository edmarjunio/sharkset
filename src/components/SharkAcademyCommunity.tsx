import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { AcademyCategory, AcademyMediaType, AcademyPost } from '../types';
import { useApp } from '../context/AppContext';
import { persistAcademyPostToFirestore } from '../lib/firebase';
import { SharksetLogo } from './SharksetLogo';
import {
  GraduationCap,
  Video,
  FileText,
  Image as ImageIcon,
  Compass,
  Shield,
  Footprints,
  Target,
  Plus,
  ThumbsUp,
  Download,
  Sparkles,
  CheckCircle2,
  Play,
  BookOpen,
  Cpu,
  Radio,
  Users,
  Eye,
  X,
} from 'lucide-react';

interface TacticalModule {
  id: AcademyCategory;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  goldenRule: string;
  steps: Array<{
    stepNumber: string;
    heading: string;
    detail: string;
  }>;
  commonMistake: string;
  proCorrection: string;
  // SVG coordinates for interactive tactical court visualization
  courtVisual: {
    attackerPos: { x: number; y: number; label: string };
    partnerAttackerPos: { x: number; y: number; label: string };
    defender1Pos: { x: number; y: number; label: string; baseAngle: number };
    defender2Pos: { x: number; y: number; label: string; baseAngle: number };
    ballVector: { x1: number; y1: number; x2: number; y2: number };
    altVector: { x1: number; y1: number; x2: number; y2: number };
    coveragePolygon: string;
    caption: string;
  };
}

const TACTICAL_MODULES: TacticalModule[] = [
  {
    id: 'marcacao_padrao',
    badge: 'FUNDAMENTO #1 · DEFESA COLETIVA',
    title: 'Marcação Padrão (Diagonal, Paralela & Cobertura)',
    subtitle: 'Como fechar os ângulos do atacante adversário sem deixar buracos no meio da quadra.',
    icon: Shield,
    goldenRule:
      'Quem está na rede fecha a pingada curta ou o bloqueio direcionado; quem está no fundo fecha a diagonal longa ou a paralela combinada antes do saque.',
    steps: [
      {
        stepNumber: '01',
        heading: 'Comunicação Antes do Levantamento Adversário',
        detail:
          'Antes da bola subir no outro lado, a dupla já define o sinal nas costas (1 dedo = fecha paralela; 2 dedos = fecha diagonal). Nunca tente cobrir os dois corredores sozinho.',
      },
      {
        stepNumber: '02',
        heading: 'Atuação do Jogador da Frente (Caçador de Pingo)',
        detail:
          'Avança até a linha de 2 metros observando o ombro do atacante. Se o atacante desacelerar o tronco para dar o pingo ou largada de chapa, o jogador da frente antecipa 2 passos curtos.',
      },
      {
        stepNumber: '03',
        heading: 'Cobertura do Jogador de Fundo (Leitura de Ataque Forte)',
        detail:
          'Posiciona-se a 1,5m da linha de fundo no corredor aberto pelo parceiro. Mantém o peito voltado para o centro da quadra para que a defesa já suba pronta para o segundo toque.',
      },
    ],
    commonMistake:
      'Os dois jogadores recuarem juntos para o fundo da quadra, entregando de graça a bola curta (pingo na rede) e a diagonal curta.',
    proCorrection:
      'Divisão escalonada (1 na frente caçando a curta + 1 no fundo fechando a batida de peito/cabeça ou Shark Attack).',
    courtVisual: {
      attackerPos: { x: 185, y: 78, label: 'Atacante' },
      partnerAttackerPos: { x: 95, y: 65, label: 'Levantador' },
      defender1Pos: { x: 175, y: 150, label: 'Frente (Pingo)', baseAngle: -105 },
      defender2Pos: { x: 88, y: 232, label: 'Fundo (Diagonal)', baseAngle: -65 },
      ballVector: { x1: 185, y1: 78, x2: 88, y2: 232 },
      altVector: { x1: 185, y1: 78, x2: 175, y2: 150 },
      coveragePolygon: '185,78 55,255 135,255',
      caption: 'Cone de Marcação Padrão: Frente fecha a curta (Pingo) · Fundo fecha o corredor da Diagonal Longa',
    },
  },
  {
    id: 'posicionamento_quadra',
    badge: 'FUNDAMENTO #2 · OCUPAÇÃO DE ESPAÇO',
    title: 'Posicionamento na Quadra & Movimento de Pêndulo',
    subtitle: 'Sincronia entre parceiros para nunca bater cabeça nem abrir o corredor central.',
    icon: Compass,
    goldenRule:
      'A quadra funciona como uma balança (Pêndulo): quando seu parceiro entra na rede para levantar de peito, você imediatamente recua e centraliza para cobrir as costas dele.',
    steps: [
      {
        stepNumber: '01',
        heading: 'Regra dos 2,5 Metros das Linhas Laterais',
        detail:
          'Na recepção de saque e defesa base, posicione-se a cerca de 2 metros da linha lateral e 1,5m da linha de fundo. Isso protege o meio da quadra e dá tempo de chegar na bola aberta.',
      },
      {
        stepNumber: '02',
        heading: 'Pêndulo Ofensivo-Defensivo Instantâneo',
        detail:
          'Assim que a primeira bola sobe e seu parceiro corre para a rede fazer o levantamento, você faz a transição em diagonal para trás, preparando tanto a entrada de ataque quanto a cobertura de bloqueio.',
      },
      {
        stepNumber: '03',
        heading: 'Triângulo de Levantamento',
        detail:
          'O levantador nunca levanta colado na fita se estiver vindo do fundo; ele para a 1 metro da rede e solta a bola em arco para dentro da quadra, dando visão limpa da marcação adversária.',
      },
    ],
    commonMistake:
      'Ficar parado assistindo o parceiro levantar na rede, deixando todo o fundo da quadra descoberto caso a bola volte de primeira.',
    proCorrection:
      'Movimentação contínua em elástico (um sobe para a rede, o outro recompõe o centro-fundo automaticamente).',
    courtVisual: {
      attackerPos: { x: 140, y: 80, label: 'Adv. Rede' },
      partnerAttackerPos: { x: 140, y: 40, label: 'Adv. Fundo' },
      defender1Pos: { x: 95, y: 142, label: 'Parceiro Sobe (Rede)', baseAngle: -45 },
      defender2Pos: { x: 155, y: 228, label: 'Pêndulo Recua (Centro)', baseAngle: -90 },
      ballVector: { x1: 155, y1: 228, x2: 95, y2: 142 },
      altVector: { x1: 95, y1: 142, x2: 145, y2: 155 },
      coveragePolygon: '95,142 155,228 195,165',
      caption: 'Efeito Pêndulo: Ao subir para levantar na rede, o parceiro bascula para cobrir o centro-fundo',
    },
  },
  {
    id: 'corrida_areia',
    badge: 'FUNDAMENTO #3 · BIOMECÂNICA E EXPLOSÃO',
    title: 'Como Correr na Areia de Forma Correta',
    subtitle: 'Técnica de tração no metatarso, passadas curtas de ajuste e economia de energia.',
    icon: Footprints,
    goldenRule:
      'Na areia fofa, quem crava o calcanhar afunda e perde 40% da velocidade de reação. O deslocamento eficiente usa o antepé (ponta/meio do pé) e passadas curtas de ajuste final.',
    steps: [
      {
        stepNumber: '01',
        heading: 'Tração de Antepé (Sem Cravar o Calcanhar)',
        detail:
          'Mantenha o peso nos metatarsos (parte frontal dos pés). O contato com a areia deve empurrar os grãos para trás e não para baixo, gerando propulsão horizontal imediata.',
      },
      {
        stepNumber: '02',
        heading: 'Passada Explosiva Inicial + Micro-Passos de Ajuste',
        detail:
          'Os 2 primeiros passos são largos e explosivos para ganhar terreno; os últimos 3 passos antes de tocar na bola são curtos e rápidos ("passinhos de ajuste") para equilibrar o tronco.',
      },
      {
        stepNumber: '03',
        heading: 'Não Cruzar as Pernas noRecuo Diagonal',
        detail:
          'Ao recuar para buscar uma bola encobrindo (lob), abra o quadril lateralmente e corra de frente/lado olhando para a bola por cima do ombro interno, jamais pulando de costas.',
      },
    ],
    commonMistake:
      'Dar passadas gigantescas até o último milissegundo e chegar desequilibrado na bola, batendo de canela ou mandando o passe para fora.',
    proCorrection:
      'Frear com micro-passos de ajuste 0,5s antes do contato, estabilizando o quadril embaixo da bola.',
    courtVisual: {
      attackerPos: { x: 110, y: 75, label: 'Saque / Lob' },
      partnerAttackerPos: { x: 185, y: 75, label: 'Adv. Base' },
      defender1Pos: { x: 85, y: 215, label: 'Arranque Antepé', baseAngle: -75 },
      defender2Pos: { x: 175, y: 160, label: 'Micro-Passos Ajuste', baseAngle: -110 },
      ballVector: { x1: 85, y1: 215, x2: 175, y2: 160 },
      altVector: { x1: 110, y1: 75, x2: 175, y2: 160 },
      coveragePolygon: '85,215 130,185 175,160 140,225',
      caption: 'Deslocamento na Areia: 2 Passadas Explosivas de Antepé + 3 Micro-Passos de Estabilização',
    },
  },
  {
    id: 'base_defesa',
    badge: 'FUNDAMENTO #4 · POSTURA & LEITURA CORPORAL',
    title: 'Base Sempre Direcionada para Facilitar a Defesa',
    subtitle: 'Ângulo de quadril, alinhamento dos pés e peito direcionado para o alvo do levantamento.',
    icon: Target,
    goldenRule:
      'Seus pés e seu quadril devem apontar sempre em diagonal para dentro da quadra (em direção ao seu parceiro/rede). Assim, a bola bate no seu peito ou coxa e já sobe na cabeça do levantador!',
    steps: [
      {
        stepNumber: '01',
        heading: 'Pé de Fora Levemente à Frente (Fechando o Corredor)',
        detail:
          'Se você defende na esquerda, seu pé esquerdo (pé da linha lateral) fica 15cm à frente do pé direito. Isso gira naturalmente seu quadril e seu peito para o centro da quadra.',
      },
      {
        stepNumber: '02',
        heading: 'Split-Step na Hora da Batida do Atacante',
        detail:
          'No exato instante em que o atacante adversário salta ou arma o pé para bater, faça uma leve ativação (destravar os joelhos na ponta dos pés) com os braços abertos para equilíbrio.',
      },
      {
        stepNumber: '03',
        heading: 'Amortecimento de Peito com Direcionamento Automático',
        detail:
          'Com a base já angulada para o meio da quadra, você não precisa girar o tronco na hora do impacto: basta expandir o tórax e absorver a velocidade da bola para ela subir limpa no meio.',
      },
    ],
    commonMistake:
      'Ficar com os dois pés retos virados para a linha de fundo adversária — quando a bola vem forte na lateral, ela espirra para fora da quadra.',
    proCorrection:
      'Base semi-aberta a 45° voltada para o centro da própria quadra (a famosa "Concha Defensiva" do Futevôlei Pro).',
    courtVisual: {
      attackerPos: { x: 195, y: 78, label: 'Atacante Forte' },
      partnerAttackerPos: { x: 90, y: 78, label: 'Parceiro Rede' },
      defender1Pos: { x: 75, y: 215, label: 'Base 45° p/ Centro', baseAngle: -45 },
      defender2Pos: { x: 185, y: 215, label: 'Base 45° p/ Centro', baseAngle: -135 },
      ballVector: { x1: 195, y1: 78, x2: 75, y2: 215 },
      altVector: { x1: 75, y1: 215, x2: 135, y2: 145 },
      coveragePolygon: '75,215 135,145 185,215',
      caption: 'Base Direcionada (45°): A defesa no fundo já rebate automaticamente para o ponto de levantamento central!',
    },
  },
];

const INITIAL_ACADEMY_POSTS: AcademyPost[] = [
  {
    id: 'post-acad-1',
    title: 'Masterclass: Marcação Padrão Diagonal vs Paralela no Buraco 4',
    category: 'marcacao_padrao',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    summary:
      'Análise em câmera lenta mostrando como o homem de rede induz o atacante a bater onde o defensor de fundo já está posicionado esperando de peito.',
    tacticalKeyPoints: [
      'Sinalização oculta antes do saque',
      'Finta de bloqueio na rede para forçar o lob',
      'Transição rápida após a defesa de peito',
    ],
    authorName: 'Prof. Rodrigo "Tubarão"',
    authorRole: 'Head Coach SHARK SET',
    arenaName: 'Arena Conflora Matriz',
    level: 'intermediario',
    likesCount: 48,
    createdAt: 'Hoje · 10:30',
  },
  {
    id: 'post-acad-2',
    title: 'Guia Biomecânico: Corrida na Areia Fofa sem Perder Explosão',
    category: 'corrida_areia',
    mediaType: 'document',
    mediaUrl: '#apostila-pdf-biom-areia',
    summary:
      'Documento técnico detalhando os exercícios de pliometria na areia, apoio no metatarso e passinhos de ajuste para chegar equilibrado nas bolas curtas e longas.',
    tacticalKeyPoints: [
      'Proibido cravar o calcanhar na arrancada',
      'Drills de escada de agilidade na areia fofa',
      '3 micro-passos de frenagem antes do toque',
    ],
    authorName: 'Dr. Felipe Moura · Preparador Físico',
    authorRole: 'Especialista em Biomecânica de Praia',
    arenaName: 'CT Shark Set Goiânia',
    level: 'todos',
    likesCount: 64,
    createdAt: 'Ontem · 18:15',
  },
  {
    id: 'post-acad-3',
    title: 'Diagrama Oficial: Como Deixar a Base Direcionada em 45° na Defesa',
    category: 'base_defesa',
    mediaType: 'image',
    mediaUrl:
      'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&auto=format&fit=crop&q=80',
    summary:
      'Infográfico visual demonstrando o posicionamento do pé externo à frente para fechar o corredor lateral e canalizar todas as defesas para o centro da rede.',
    tacticalKeyPoints: [
      'Pé de fora 15cm adiantado',
      'Quadril aberto apontando para o levantador',
      'Split-step sincronizado com o salto do atacante',
    ],
    authorName: 'Lucas "Tubarão" & Gabriel "Pingo"',
    authorRole: 'Dupla Campeã Série A',
    arenaName: 'Arena Conflora',
    level: 'iniciante',
    likesCount: 92,
    createdAt: 'Há 2 dias',
  },
  {
    id: 'post-acad-4',
    title: 'Posicionamento em Pêndulo: Nunca Mais Deixe o Meio da Quadra Aberto',
    category: 'posicionamento_quadra',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    summary:
      'Treino prático de sombra em dupla ensinando a cobertura automática quando seu parceiro vai buscar o segundo toque colado na rede.',
    tacticalKeyPoints: [
      'Sincronia visual com as costas do parceiro',
      'Cobertura de bola de segunda do adversário',
      'Voz de comando: "Minha!", "Vai na curta!", "Fundo livre!"',
    ],
    authorName: 'Coach Matheus Areia',
    authorRole: 'Instrutor Oficial SHARK SET',
    arenaName: 'Arena Praia Clube',
    level: 'intermediario',
    likesCount: 39,
    createdAt: 'Há 3 dias',
  },
];

const LOCAL_ACADEMY_STORAGE_KEY = 'sharkset_v1_academy_posts';

const CATEGORY_LABELS: Record<AcademyCategory, string> = {
  marcacao_padrao: 'Marcação Padrão',
  posicionamento_quadra: 'Posicionamento na Quadra',
  corrida_areia: 'Corrida na Areia',
  base_defesa: 'Base Direcionada (Defesa)',
  ataque_shark: 'Ataque & Shark Attack',
  comunidade: 'Dica da Comunidade',
};

export const SharkAcademyCommunity: React.FC = () => {
  const { tenant, userProfile } = useApp();

  const [activeTacticalId, setActiveTacticalId] = useState<AcademyCategory>('marcacao_padrao');
  const [mediaFilter, setMediaFilter] = useState<'all' | AcademyMediaType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AcademyCategory>('all');

  const [posts, setPosts] = useState<AcademyPost[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ACADEMY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ACADEMY_POSTS;
  });

  // New Post Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<AcademyCategory>('marcacao_padrao');
  const [newMediaType, setNewMediaType] = useState<AcademyMediaType>('video');
  const [newMediaUrl, setNewMediaUrl] = useState<string>('');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newKeyPointsText, setNewKeyPointsText] = useState<string>('');
  const [newLevel, setNewLevel] = useState<'iniciante' | 'intermediario' | 'avancado' | 'todos'>('todos');
  const [newAuthor, setNewAuthor] = useState<string>(userProfile.name || 'Atleta SHARK SET');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Selected post for full preview
  const [selectedPostPreview, setSelectedPostPreview] = useState<AcademyPost | null>(null);

  const activeModule = useMemo(
    () => TACTICAL_MODULES.find((m) => m.id === activeTacticalId) || TACTICAL_MODULES[0],
    [activeTacticalId]
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (mediaFilter !== 'all' && p.mediaType !== mediaFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      return true;
    });
  }, [posts, mediaFilter, categoryFilter]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleLikePost = (postId: string) => {
    setPosts((prev) => {
      const updated = prev.map((p) =>
        p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p
      );
      try {
        localStorage.setItem(LOCAL_ACADEMY_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;

    const points = newKeyPointsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const created: AcademyPost = {
      id: `acad-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      mediaType: newMediaType,
      mediaUrl:
        newMediaUrl.trim() ||
        (newMediaType === 'image'
          ? 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&auto=format&fit=crop&q=80'
          : '#conteudo-sharkset'),
      summary: newSummary.trim(),
      tacticalKeyPoints:
        points.length > 0
          ? points
          : ['Posicionamento equilibrado', 'Leitura corporal antecipada', 'Base direcionada pro centro'],
      authorName: newAuthor.trim() || 'Membro Comunidade SHARK SET',
      authorRole: 'Treinador / Atleta Verificado',
      arenaName: tenant.name,
      level: newLevel,
      likesCount: 1,
      createdAt: 'Agora mesmo',
    };

    const nextPosts = [created, ...posts];
    setPosts(nextPosts);
    try {
      localStorage.setItem(LOCAL_ACADEMY_STORAGE_KEY, JSON.stringify(nextPosts));
    } catch {
      // ignore
    }

    await persistAcademyPostToFirestore(created);

    setNewTitle('');
    setNewMediaUrl('');
    setNewSummary('');
    setNewKeyPointsText('');
    setShowCreateModal(false);
    showToast(
      `Material "${created.title}" publicado na Comunidade SHARKSET e sincronizado com o Firestore!`
    );
  };

  const handleDownloadPlaybookPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(7, 29, 61);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('SHARKSET - MANUAL TATICO DE FUTEVOLEI', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(18, 199, 187);
    doc.text(
      'Guia Oficial: Marcacao Padrao, Posicionamento, Corrida na Areia e Base de Defesa',
      14,
      28
    );

    let y = 48;
    TACTICAL_MODULES.forEach((mod, index) => {
      if (y > 240) {
        doc.addPage();
        y = 24;
      }
      doc.setTextColor(9, 135, 206);
      doc.setFontSize(13);
      doc.text(`${index + 1}. ${mod.title}`, 14, y);
      y += 6;

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9.5);
      const ruleLines = doc.splitTextToSize(`Regra de Ouro: ${mod.goldenRule}`, 180);
      doc.text(ruleLines, 14, y);
      y += ruleLines.length * 5 + 3;

      mod.steps.forEach((st) => {
        const stLines = doc.splitTextToSize(
          `[${st.stepNumber}] ${st.heading}: ${st.detail}`,
          176
        );
        doc.text(stLines, 18, y);
        y += stLines.length * 4.8 + 2;
      });

      const fixLines = doc.splitTextToSize(`Ajuste Pro: ${mod.proCorrection}`, 180);
      doc.setTextColor(15, 118, 110);
      doc.text(fixLines, 14, y);
      y += fixLines.length * 5 + 8;
    });

    doc.save('Apostila-Tatica-Futevolei-SHARKSET.pdf');
    showToast('Apostila Tática Oficial SHARKSET (PDF) gerada e baixada com sucesso!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-[#F7FAFD]">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="aquarium-glass fixed bottom-6 right-6 z-50 max-w-md bg-[#071D3D] text-white px-4 py-3 rounded-2xl shadow-2xl border-2 border-[#12C7BB] flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* HERO HEADER: SHARK ACADEMY & COMUNIDADE FUTEVÔLEI SHARKSET          */}
      {/* =================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0B254E] border-2 border-[#0987CE] p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#0987CE]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#0987CE] text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                <GraduationCap className="w-3.5 h-3.5" />
                SHARK ACADEMY · COMUNIDADE FUTEVÔLEI SHARKSET
              </span>
              <span className="px-3 py-1 rounded-full bg-[#030B17] border border-[#12C7BB]/50 text-[#12C7BB] font-mono text-[11px] font-bold">
                Evolução Técnica & Tática
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Domine a Marcação Padrão, o Posicionamento e a Base de Defesa na Areia
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Centro oficial de ensinamentos do futevôlei alimentado pela comunidade <strong>SHARKSET</strong>.
              Aprenda a correr na areia sem afundar o calcanhar, posicionar o quadril a 45° para facilitar a defesa e compartilhe vídeos, apostilas PDF e diagramas táticos.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#0987CE]/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Postar Vídeo, Documento ou Imagem
              </button>

              <button
                type="button"
                onClick={handleDownloadPlaybookPDF}
                className="aquarium-glass px-4 py-2.5 rounded-2xl bg-[#030B17] hover:bg-[#0B254E] border border-[#12C7BB] text-[#12C7BB] font-black text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Apostila Tática Completa (PDF)
              </button>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center bg-[#030B17]/80 border border-[#145A9B] rounded-2xl p-4">
            <SharksetLogo size="lg" />
            <span className="text-[10px] font-mono text-slate-300 mt-2 font-bold uppercase tracking-wider">
              CT Oficial · {posts.length} Materiais Ativos
            </span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BLOCO 1: LABORATÓRIO TÁTICO INTERATIVO (OS 4 PILARES DO FUTEVÔLEI)  */}
      {/* =================================================================== */}
      <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#145A9B]/70 pb-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#12C7BB] block">
              PRANCHETA TÁTICA INTERATIVA · PASSO A PASSO
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              4 Fundamentos Essenciais para Evoluir Rápido no Futevôlei
            </h2>
          </div>

          {/* 4 Module Selector Tabs */}
          <div className="aquarium-glass flex flex-wrap items-center gap-1.5 bg-[#030B17] p-1.5 rounded-2xl border border-[#145A9B]">
            {TACTICAL_MODULES.map((mod) => {
              const IconComp = mod.icon;
              const isSelected = mod.id === activeTacticalId;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveTacticalId(mod.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                      : 'text-slate-300 hover:text-white hover:bg-[#071D3D]'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{CATEGORY_LABELS[mod.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Module Content Grid: Left = Deep Methodology | Right = Interactive Sand Court Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: Step-by-Step Breakdown */}
          <div className="lg:col-span-7 space-y-4">
            <div className="aquarium-glass p-4 rounded-2xl bg-[#030B17] border border-[#0987CE]/60 space-y-1.5">
              <span className="px-2.5 py-0.5 rounded bg-[#0987CE]/20 text-[#5BC3FA] font-black text-[10px] uppercase tracking-wider">
                {activeModule.badge}
              </span>
              <h3 className="text-lg font-black text-white">{activeModule.title}</h3>
              <p className="text-xs text-slate-300">{activeModule.subtitle}</p>
              <div className="pt-2 mt-2 border-t border-[#145A9B]/50 text-xs text-[#12C7BB] font-bold flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Regra de Ouro do Tuba:</strong> {activeModule.goldenRule}
                </span>
              </div>
            </div>

            {/* 3 Tactical Steps */}
            <div className="space-y-3">
              {activeModule.steps.map((st) => (
                <div
                  key={st.stepNumber}
                  className="p-4 rounded-2xl bg-[#030B17]/80 border border-[#145A9B] flex items-start gap-3.5 hover:border-[#0987CE] transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-[#0987CE] text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {st.stepNumber}
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-black text-white">{st.heading}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{st.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Common Mistake vs Pro Correction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="aquarium-glass p-3.5 rounded-2xl bg-[#030B17] border border-[#145A9B] space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  ❌ Erro Mais Comum na Areia
                </span>
                <p className="text-xs text-slate-200 font-medium">{activeModule.commonMistake}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0987CE]/15 border border-[#12C7BB] space-y-1">
                <span className="text-[10px] font-black uppercase text-[#12C7BB] block">
                  ✅ Ajuste Técnico SHARKSET
                </span>
                <p className="text-xs text-white font-bold">{activeModule.proCorrection}</p>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Interactive SVG Futevolei Court Tactical Diagram */}
          <div className="aquarium-glass lg:col-span-5 bg-[#030B17] border-2 border-[#0987CE] rounded-3xl p-4 sm:p-5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#5BC3FA] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#12C7BB]" />
                Simulador Visual de Quadra (9m x 18m)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#071D3D] border border-[#145A9B] text-[10px] font-mono text-slate-300">
                Base & Vetores
              </span>
            </div>

            <div className="w-full flex justify-center">
              <svg
                viewBox="0 0 280 300"
                className="aquarium-glass w-full max-w-[320px] rounded-2xl border border-[#145A9B] bg-[#071D3D]"
                aria-label="Diagrama Tático da Quadra de Futevôlei"
              >
                {/* Court Outer Lines */}
                <rect
                  x="30"
                  y="20"
                  width="220"
                  height="260"
                  fill="#0A254D"
                  stroke="#5BC3FA"
                  strokeWidth="2.5"
                  rx="4"
                />

                {/* Court Quadrants / Reference Grid */}
                <line
                  x1="140"
                  y1="20"
                  x2="140"
                  y2="280"
                  stroke="#145A9B"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <line
                  x1="30"
                  y1="95"
                  x2="250"
                  y2="95"
                  stroke="#145A9B"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1="30"
                  y1="205"
                  x2="250"
                  y2="205"
                  stroke="#145A9B"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Defensive Coverage Cone */}
                <polygon
                  points={activeModule.courtVisual.coveragePolygon}
                  fill="rgba(18, 199, 187, 0.18)"
                  stroke="#12C7BB"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />

                {/* Net (Rede Central) */}
                <line x1="22" y1="120" x2="258" y2="120" stroke="#FFFFFF" strokeWidth="4" />
                <text x="140" y="115" textAnchor="middle" fill="#F7FAFD" fontSize="8" fontWeight="900">
                  REDE OFICIAL (2,20m)
                </text>

                {/* Primary Trajectory Arrow */}
                <line
                  x1={activeModule.courtVisual.ballVector.x1}
                  y1={activeModule.courtVisual.ballVector.y1}
                  x2={activeModule.courtVisual.ballVector.x2}
                  y2={activeModule.courtVisual.ballVector.y2}
                  stroke="#12C7BB"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                />

                {/* Secondary / Option Trajectory Arrow */}
                <line
                  x1={activeModule.courtVisual.altVector.x1}
                  y1={activeModule.courtVisual.altVector.y1}
                  x2={activeModule.courtVisual.altVector.x2}
                  y2={activeModule.courtVisual.altVector.y2}
                  stroke="#0987CE"
                  strokeWidth="2"
                />

                {/* Opponents (Top Side) */}
                <g>
                  <circle
                    cx={activeModule.courtVisual.attackerPos.x}
                    cy={activeModule.courtVisual.attackerPos.y}
                    r="11"
                    fill="#030B17"
                    stroke="#5BC3FA"
                    strokeWidth="2"
                  />
                  <text
                    x={activeModule.courtVisual.attackerPos.x}
                    y={activeModule.courtVisual.attackerPos.y + 3}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="7"
                    fontWeight="800"
                  >
                    ADV
                  </text>
                  <text
                    x={activeModule.courtVisual.attackerPos.x}
                    y={activeModule.courtVisual.attackerPos.y - 15}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="7.5"
                    fontWeight="700"
                  >
                    {activeModule.courtVisual.attackerPos.label}
                  </text>
                </g>

                <g>
                  <circle
                    cx={activeModule.courtVisual.partnerAttackerPos.x}
                    cy={activeModule.courtVisual.partnerAttackerPos.y}
                    r="10"
                    fill="#030B17"
                    stroke="#145A9B"
                    strokeWidth="2"
                  />
                  <text
                    x={activeModule.courtVisual.partnerAttackerPos.x}
                    y={activeModule.courtVisual.partnerAttackerPos.y - 14}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="7"
                    fontWeight="700"
                  >
                    {activeModule.courtVisual.partnerAttackerPos.label}
                  </text>
                </g>

                {/* SHARKSET Defenders (Bottom Side) with Base Orientation Indicators */}
                {[activeModule.courtVisual.defender1Pos, activeModule.courtVisual.defender2Pos].map(
                  (def, idx) => (
                    <g key={idx}>
                      {/* Base Orientation Foot Bar */}
                      <g
                        transform={`translate(${def.x}, ${def.y}) rotate(${def.baseAngle})`}
                      >
                        <line
                          x1="-14"
                          y1="-8"
                          x2="-14"
                          y2="8"
                          stroke="#12C7BB"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <line
                          x1="0"
                          y1="0"
                          x2="18"
                          y2="0"
                          stroke="#12C7BB"
                          strokeWidth="2"
                        />
                      </g>
                      <circle
                        cx={def.x}
                        cy={def.y}
                        r="12"
                        fill="#0987CE"
                        stroke="#F7FAFD"
                        strokeWidth="2.2"
                      />
                      <text
                        x={def.x}
                        y={def.y + 3}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="7.5"
                        fontWeight="900"
                      >
                        T{idx + 1}
                      </text>
                      <text
                        x={def.x}
                        y={def.y + 23}
                        textAnchor="middle"
                        fill="#12C7BB"
                        fontSize="8"
                        fontWeight="800"
                      >
                        {def.label}
                      </text>
                    </g>
                  )
                )}
              </svg>
            </div>

            <p className="text-[11px] text-center text-slate-300 font-medium bg-[#071D3D] p-2.5 rounded-xl border border-[#145A9B]">
              {activeModule.courtVisual.caption}
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BLOCO 2: MURAL DA COMUNIDADE (VÍDEOS, DOCUMENTOS PDF & IMAGENS)     */}
      {/* =================================================================== */}
      <div className="space-y-4">
        <div className="aquarium-glass flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#071D3D] border border-[#145A9B] rounded-2xl p-4">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#0987CE]" />
              Biblioteca & Feed da Comunidade Futevôlei SHARKSET
            </h2>
            <p className="text-xs text-slate-300">
              Vídeos de treino, apostilas em documento e diagramas postados por professores e atletas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Media Type Filter */}
            <div className="flex items-center gap-1 bg-[#030B17] p-1 rounded-xl border border-[#145A9B]">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'video', label: '🎬 Vídeos' },
                { id: 'document', label: '📄 Documentos' },
                { id: 'image', label: '🖼️ Imagens' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaFilter(tab.id as 'all' | AcademyMediaType)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mediaFilter === tab.id
                      ? 'bg-[#0987CE] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | AcademyCategory)}
              className="px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-xs font-bold text-white focus:outline-none focus:border-[#0987CE]"
            >
              <option value="all">Todos os Fundamentos</option>
              <option value="marcacao_padrao">Marcação Padrão</option>
              <option value="posicionamento_quadra">Posicionamento na Quadra</option>
              <option value="corrida_areia">Corrida na Areia</option>
              <option value="base_defesa">Base Direcionada (Defesa)</option>
              <option value="ataque_shark">Ataque & Shark Attack</option>
            </select>
          </div>
        </div>

        {/* Community Posts Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] hover:border-[#0987CE] rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black text-[10px] uppercase flex items-center gap-1">
                      {post.mediaType === 'video' && <Video className="w-3 h-3" />}
                      {post.mediaType === 'document' && <FileText className="w-3 h-3" />}
                      {post.mediaType === 'image' && <ImageIcon className="w-3 h-3" />}
                      {post.mediaType === 'video'
                        ? 'VÍDEO AULA'
                        : post.mediaType === 'document'
                        ? 'DOCUMENTO / PDF'
                        : 'IMAGEM / DIAGRAMA'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#030B17] border border-[#145A9B] text-[#12C7BB] font-bold text-[10px] uppercase">
                      {CATEGORY_LABELS[post.category]}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    Nível: <strong className="text-white uppercase">{post.level}</strong>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                  {post.title}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed">{post.summary}</p>

                {post.tacticalKeyPoints && post.tacticalKeyPoints.length > 0 && (
                  <div className="aquarium-glass p-3 rounded-2xl bg-[#030B17] border border-[#145A9B]/70 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-[#5BC3FA] block">
                      Pontos-Chave do Material:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {post.tacticalKeyPoints.map((pt, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#12C7BB] shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#145A9B]/60 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-black text-white block">{post.authorName}</span>
                  <span className="text-[10px] text-slate-400">
                    {post.arenaName || tenant.name} · {post.createdAt || 'Recente'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLikePost(post.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#12C7BB] font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{post.likesCount}</span>
                  </button>

                  {post.mediaType === 'document' ? (
                    <button
                      type="button"
                      onClick={handleDownloadPlaybookPDF}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar PDF
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedPostPreview(post)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Abrir Material
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BLOCO 3: ARQUITETURA DE IA EM TEMPO REAL (VISÃO COMPUTACIONAL + NARRAÇÃO) */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0B254E] border-2 border-[#12C7BB] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#145A9B] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#12C7BB] text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                ROADMAP DE INOVAÇÃO · SHARKSET VISION AI
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE AI NARRATOR READY
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white">
              Reconhecimento de Jogo por IA & Comentários Ao Vivo em Tempo Real
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="aquarium-glass p-4 rounded-2xl bg-[#030B17] border border-[#145A9B] space-y-2">
            <span className="px-2 py-0.5 rounded bg-[#0987CE]/20 text-[#5BC3FA] font-black text-[10px] uppercase">
              ETAPA 1 · CAPTURA & RASTREAMENTO
            </span>
            <h3 className="text-sm font-black text-white">
              Visão Computacional (Bola, Rede e 4 Atletas)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              A câmera da quadra envia frames via WebRTC/WebSocket. Modelos leves (YOLO / MediaPipe Pose + Gemini Multimodal Live API) identificam a trajetória da bola, o posicionamento de cada dupla e o tipo de golpe (<em>Shark Attack</em>, <em>Pingo</em>, <em>Defesa de Peito</em> ou <em>Ace</em>).
            </p>
          </div>

          <div className="aquarium-glass p-4 rounded-2xl bg-[#030B17] border border-[#145A9B] space-y-2">
            <span className="px-2 py-0.5 rounded bg-[#0987CE]/20 text-[#5BC3FA] font-black text-[10px] uppercase">
              ETAPA 2 · ANÁLISE TÁTICA EM TEMPO REAL
            </span>
            <h3 className="text-sm font-black text-white">
              Leitura de Marcação e Estatísticas Automáticas
            </h3>
            <p className="text-slate-300 leading-relaxed">
              A IA cruza a posição dos jogadores com os fundamentos da <strong>Academia do Tuba</strong>: detecta se a dupla abriu o corredor central, conta quantos segundos durou o rally e atualiza o placar e estatísticas no Firestore sem intervenção manual.
            </p>
          </div>

          <div className="aquarium-glass p-4 rounded-2xl bg-[#030B17] border border-[#145A9B] space-y-2">
            <span className="px-2 py-0.5 rounded bg-[#12C7BB]/20 text-[#12C7BB] font-black text-[10px] uppercase">
              ETAPA 3 · NARRAÇÃO & COMENTÁRIOS DE VOZ
            </span>
            <h3 className="text-sm font-black text-white">
              Locutor IA "Tuba Caster" (Texto & Voz Ao Vivo)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Com a <strong>Gemini Live API (Áudio Nativo de Baixa Latência)</strong>, o sistema gera comentários emocionantes em português ou inglês em tempo real na transmissão: <em>"Que defesa de peito na diagonal! Lucas subiu no 3º andar e soltou o Shark Attack!"</em>
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL DE PUBLICAÇÃO DE CONTEÚDO NA COMUNIDADE                       */}
      {/* =================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="aquarium-glass w-full max-w-lg bg-[#071D3D] border-2 border-[#0987CE] rounded-3xl p-6 shadow-2xl space-y-4 text-[#F7FAFD]">
            <div className="flex items-center justify-between border-b border-[#145A9B] pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#12C7BB]" />
                <h3 className="text-base font-black text-white">
                  Publicar Ensinamento na Comunidade SHARKSET
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl bg-[#030B17] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Título da Aula / Dica Técnica *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Como posicionar a base aberta para defender Shark Attack"
                  className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Fundamento *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as AcademyCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold"
                  >
                    <option value="marcacao_padrao">Marcação Padrão</option>
                    <option value="posicionamento_quadra">Posicionamento na Quadra</option>
                    <option value="corrida_areia">Corrida na Areia</option>
                    <option value="base_defesa">Base Direcionada (Defesa)</option>
                    <option value="ataque_shark">Ataque & Shark Attack</option>
                    <option value="comunidade">Dica Geral da Comunidade</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Formato do Material *</label>
                  <select
                    value={newMediaType}
                    onChange={(e) => setNewMediaType(e.target.value as AcademyMediaType)}
                    className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold"
                  >
                    <option value="video">🎬 Vídeo Técnico</option>
                    <option value="document">📄 Documento / Apostila PDF</option>
                    <option value="image">🖼️ Imagem / Diagrama de Quadra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Seu Nome / Professor</label>
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nível Recomendado</label>
                  <select
                    value={newLevel}
                    onChange={(e) =>
                      setNewLevel(
                        e.target.value as 'iniciante' | 'intermediario' | 'avancado' | 'todos'
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold"
                  >
                    <option value="todos">Todos os Níveis</option>
                    <option value="iniciante">Iniciante</option>
                    <option value="intermediario">Série C / Série B</option>
                    <option value="avancado">Série A / Profissional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Link do Vídeo (YouTube/MP4), Imagem ou Documento (Opcional)
                </label>
                <input
                  type="text"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Explicação Técnica Detalhada *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Explique o posicionamento dos pés, leitura de ombro ou movimentação na areia..."
                  className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Dicas Práticas (1 por linha)
                </label>
                <textarea
                  rows={2}
                  value={newKeyPointsText}
                  onChange={(e) => setNewKeyPointsText(e.target.value)}
                  placeholder={"Mantenha o peso na ponta dos pés\nQuadril angulado a 45 graus pro centro"}
                  className="w-full px-3 py-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#030B17] text-slate-300 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black cursor-pointer shadow-md"
                >
                  Publicar na Comunidade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL DE VISUALIZAÇÃO DO MATERIAL                                   */}
      {/* =================================================================== */}
      {selectedPostPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="aquarium-glass w-full max-w-2xl bg-[#071D3D] border-2 border-[#0987CE] rounded-3xl p-6 shadow-2xl space-y-4 text-[#F7FAFD]">
            <div className="flex items-center justify-between border-b border-[#145A9B] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#12C7BB] block">
                  {CATEGORY_LABELS[selectedPostPreview.category]}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {selectedPostPreview.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPostPreview(null)}
                className="p-1.5 rounded-xl bg-[#030B17] text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPostPreview.mediaType === 'image' && selectedPostPreview.mediaUrl && (
              <div className="aquarium-glass rounded-2xl overflow-hidden border border-[#145A9B] max-h-72 bg-[#030B17]">
                <img
                  src={selectedPostPreview.mediaUrl}
                  alt={selectedPostPreview.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {selectedPostPreview.mediaType === 'video' && (
              <div className="aquarium-glass p-6 rounded-2xl bg-[#030B17] border border-[#145A9B] text-center space-y-2">
                <Play className="w-10 h-10 text-[#0987CE] mx-auto" />
                <p className="text-xs font-bold text-white">
                  Aula Técnica em Vídeo · {selectedPostPreview.authorName}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selectedPostPreview.summary}
                </p>
              </div>
            )}

            <div className="space-y-2 text-xs text-slate-200">
              <p className="leading-relaxed">{selectedPostPreview.summary}</p>
              {selectedPostPreview.tacticalKeyPoints && (
                <div className="p-3.5 rounded-xl bg-[#030B17] border border-[#145A9B] space-y-1">
                  <span className="font-black text-[#12C7BB] uppercase text-[10px] block">
                    Checklist de Execução na Quadra:
                  </span>
                  {selectedPostPreview.tacticalKeyPoints.map((pt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0987CE] shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#145A9B]">
              <span className="text-xs text-slate-400">
                Publicado por <strong className="text-white">{selectedPostPreview.authorName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedPostPreview(null)}
                className="px-4 py-2 rounded-xl bg-[#0987CE] text-white font-black text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
