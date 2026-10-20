import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Trophy,
  Building2,
  GraduationCap,
  Zap,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export const SaaSConversionHub: React.FC = () => {
  const {
    availableTenants,
    tenant,
    setTenantId,
    tournaments,
    classStudents,
    setActiveTab,
    setArenaSubTab,
    createNewArenaTenant,
    createTournament,
  } = useApp();

  const [arenaName, setArenaName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('GO');
  const [whatsapp, setWhatsapp] = useState('');
  const [courtsCount, setCourtsCount] = useState(4);
  const [selectedPlan, setSelectedPlan] = useState<'arena_pro_99' | 'pay_per_table_20'>('arena_pro_99');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [quickTournName, setQuickTournName] = useState('');
  const [quickTournOrganizer, setQuickTournOrganizer] = useState('');
  const [quickTournPhone, setQuickTournPhone] = useState('');

  const [simCourts, setSimCourts] = useState(3);
  const [simStudents, setSimStudents] = useState(40);
  const [simTournamentsPerMonth, setSimTournamentsPerMonth] = useState(2);

  const estimatedMonthlyRevenue =
    simCourts * 85 * 25 +
    simStudents * 220 +
    simTournamentsPerMonth * 16 * 120;

  const handleOnboardNewArena = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arenaName.trim() || !city.trim() || !ownerName.trim()) return;

    const created = createNewArenaTenant({
      name: arenaName.trim(),
      ownerName: ownerName.trim(),
      city: city.trim(),
      state: stateUf.trim() || 'GO',
      whatsapp: whatsapp.trim() || '(64) 99911-2233',
      courtsCount,
      plan: selectedPlan,
    });

    setArenaName('');
    setOwnerName('');
    setCity('');
    setWhatsapp('');
    setFeedbackBanner(
      `Arena "${created.name}" ativada com sucesso no ${
        selectedPlan === 'arena_pro_99' ? 'Plano Mensal R$ 99/mês' : 'Modelo R$ 20/tabela'
      }! Quadras, aulas e chaveamento já estão prontos para uso.`
    );
  };

  const handleUnlockSingleTable20 = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse =
      quickTournName.trim() || `Copa ${tenant.name} - Tabela Oficial SHARK SET`;
    const orgToUse = quickTournOrganizer.trim() || 'Organizador Oficial';
    const phoneToUse = quickTournPhone.trim() || tenant.whatsapp;

    try {
      await createTournament({
        name: nameToUse,
        sport: 'futevolei',
        category: 'iniciante_serie_c',
        modalityFormat: 'duplas',
        semiFormat: 'semi_direta',
        date: new Date().toISOString().split('T')[0],
        location: `${tenant.name} · ${tenant.city} - ${tenant.state}`,
        specificRules:
          'Set único até 18 pontos. Tabela oficial liberada por R$ 20,00 com placar ao vivo e súmula do árbitro.',
        maxPairs: 8,
        registrationFee: 120,
        responsibleName: orgToUse,
        responsiblePhone: phoneToUse,
      });

      setActiveTab('tournaments');
    } catch (error) { setFeedbackBanner(error instanceof Error ? error.message : 'Não foi possível publicar o torneio.'); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-white">
      {feedbackBanner && (
        <div className="aquarium-glass bg-[#071D3D] text-white border-2 border-[#12C7BB] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
            <Sparkles className="w-5 h-5 text-[#12C7BB] shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setArenaSubTab('agenda');
                setActiveTab('scheduler');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0987CE] text-white font-black text-xs cursor-pointer"
            >
              Abrir Agenda & Aulas da Arena
            </button>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-300 hover:text-white px-2 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* HERO BANNER */}
      <div className="aquarium-glass bg-[#071D3D] text-white border-2 border-[#145A9B] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-[#0987CE] text-white font-black uppercase tracking-tight">
                SHARK SET SaaS · ESCALA 1.000+ ARENAS
              </span>
              <span className="text-slate-300 font-semibold">
                {availableTenants.length} Arenas Ativas · {tournaments.length} Tabelas Simultâneas · {classStudents.length} Alunos Matriculados
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              A Tabela de Campeonato Mais Intuitiva do Brasil por{' '}
              <span className="text-[#5BC3FA]">R$ 20</span> ou sua Arena Completa por{' '}
              <span className="text-[#12C7BB]">R$ 99/mês</span>.
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Qualquer pessoa acompanha os jogos ao vivo, inscreve duplas, matricula alunos nas aulas e recebe notificações automáticas no vencimento da mensalidade.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('tournaments')}
              className="px-6 py-3.5 rounded-2xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <Trophy className="w-4 h-4" />
              Ver Tabela de Campeonato Ao Vivo
            </button>
            <button
              onClick={() => {
                setArenaSubTab('aulas');
                setActiveTab('scheduler');
              }}
              className="px-6 py-3.5 rounded-2xl bg-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <GraduationCap className="w-4 h-4" />
              Gestão de Aulas & Mensalidades
            </button>
          </div>
        </div>
      </div>

      {/* PRICING & CONVERSION CARDS: R$ 20 / TABELA vs R$ 99 / MÊS ARENA PRO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: R$ 20 POR TABELA DE CAMPEONATO */}
        <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white bg-[#0987CE] px-3 py-1 rounded-lg">
                ACESSO POR CAMPEONATO · FOCO NA TABELA
              </span>
              <span className="text-xs font-bold text-[#12C7BB]">Liberação Instantânea</span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Tabela Oficial de Campeonato</h2>
              <p className="text-xs text-slate-300 mt-1">
                Perfeito para organizadores independentes, copas de fim de semana e torneios rápidos.
              </p>
            </div>

            <div className="flex items-baseline gap-2 pt-2 border-t border-[#145A9B]/60">
              <span className="text-4xl sm:text-5xl font-black text-[#5BC3FA] font-mono">R$ 20</span>
              <span className="text-sm font-bold text-slate-300">/ por tabela de campeonato</span>
            </div>

            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-200 pt-2">
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                Tabela visual super intuitiva com chave de vencedores (verde) e perdedores (vermelho)
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                Inscrição com vaga garantida + confirmação por pagamento dos 2 atletas
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                Sorteio aleatório ou escolha manual das duplas presentes na chave
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                Súmula do Árbitro + Página da Partida com Chat Ao Vivo e Histórico de Pontos
              </li>
            </ul>
          </div>

          <form onSubmit={handleUnlockSingleTable20} className="aquarium-glass bg-[#030B17] border border-[#145A9B] rounded-2xl p-4 space-y-3">
            <div className="text-xs font-extrabold text-[#5BC3FA] uppercase tracking-wider">
              Liberar Nova Tabela Agora por R$ 20,00:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <input
                type="text"
                value={quickTournName}
                onChange={(e) => setQuickTournName(e.target.value)}
                placeholder="Nome do Torneio (ex: 1ª Copa Amigos)"
                className="w-full px-3 py-2.5 bg-[#071D3D] border border-[#145A9B] rounded-xl font-semibold text-white"
              />
              <input
                type="text"
                value={quickTournOrganizer}
                onChange={(e) => setQuickTournOrganizer(e.target.value)}
                placeholder="Seu Nome (Organizador)"
                className="w-full px-3 py-2.5 bg-[#071D3D] border border-[#145A9B] rounded-xl font-semibold text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Trophy className="w-4 h-4" />
              Gerar Tabela Oficial por R$ 20,00 & Abrir Chave
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* CARD 2: R$ 99 / MÊS PLANO ARENA COMPLETA */}
        <div className="bg-gradient-to-b from-[#0B254E] via-[#071D3D] to-[#030B17] text-white border-2 border-[#12C7BB] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-950 bg-[#12C7BB] px-3 py-1 rounded-lg">
                MAIS VENDIDO · PLANO MENSAL ARENA PRO
              </span>
              <span className="text-xs font-bold text-[#12C7BB]">Tabelas Ilimitadas Inclusas</span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Gestão Completa para Arenas</h2>
              <p className="text-xs text-slate-300 mt-1">
                Agendamentos, Aulas, Gestão de Alunos & Mensalidades, Ranking e Tabelas Ilimitadas.
              </p>
            </div>

            <div className="flex items-baseline gap-2 pt-2 border-t border-[#145A9B]">
              <span className="text-4xl sm:text-5xl font-black text-[#12C7BB] font-mono">R$ 99</span>
              <span className="text-sm font-bold text-slate-300">/ mês por arena (tudo liberado)</span>
            </div>

            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-200 pt-2">
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                <strong>Tabelas de Campeonato Ilimitadas</strong> (economize R$ 20 em cada torneio)
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                <strong>Gestão de Aulas, Turmas e Mensalidades:</strong> Aluno, Professor ou Dono inscrevem na turma
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                <strong>Ciclo Mensal Automático:</strong> Começa no dia da inscrição + aviso automático no vencimento
              </li>
              <li className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                <strong>Agenda de Quadras Inteligente:</strong> Preços de Pico / Dia da Semana + Alerta de Vaga em 2h
              </li>
            </ul>
          </div>

          <div className="aquarium-glass bg-[#030B17] border border-[#145A9B] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#12C7BB]">
                ⚡ 1 único horário de quadra alugado já paga o mês inteiro!
              </span>
              <span className="font-mono text-slate-400">Sem fidelidade</span>
            </div>
            <a
              href="#cadastrar-arena-99"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <Building2 className="w-4 h-4" />
              Ativar Plano Mensal Arena PRO (R$ 99/mês)
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* ONBOARDING ENGINE FOR 1,000+ ARENAS + ROI SIMULATOR */}
      <div id="cadastrar-arena-99" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* New Arena Instant Onboarding Form (7 cols) */}
        <div className="aquarium-glass lg:col-span-7 bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <div className="space-y-1 border-b border-[#145A9B]/60 pb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#12C7BB]">
              CAPTAÇÃO DE CLIENTES · ARQUITETURA MULTI-ARENA ESCALÁVEL
            </span>
            <h3 className="text-xl font-black text-white">
              Cadastre sua Arena em 30 Segundos e Comece a Operar Agora
            </h3>
            <p className="text-xs text-slate-300">
              Pronto para rodar mais de 1.000 arenas e centenas de torneios ao mesmo tempo.
            </p>
          </div>

          <form onSubmit={handleOnboardNewArena} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nome da Arena / Centro Esportivo *</label>
                <input
                  type="text"
                  required
                  value={arenaName}
                  onChange={(e) => setArenaName(e.target.value)}
                  placeholder="Ex: Arena Shark Beach Uberlândia"
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-semibold text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nome do Dono ou Professor *</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex: Prof. Marcos Silva"
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-semibold text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-bold text-slate-300 mb-1">Cidade *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Goiânia"
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-semibold text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                  placeholder="GO"
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-mono font-bold text-white uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nº de Quadras</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={courtsCount}
                  onChange={(e) => setCourtsCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-mono font-bold text-white"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-bold text-slate-300 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(62) 99999-0000"
                  className="w-full px-3.5 py-2.5 bg-[#030B17] border border-[#145A9B] rounded-xl font-mono text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-bold text-slate-300">Escolha a Modalidade de Contratação:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('arena_pro_99')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    selectedPlan === 'arena_pro_99'
                      ? 'border-[#12C7BB] bg-[#030B17] text-white'
                      : 'border-[#145A9B] bg-[#030B17]/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">Plano Arena PRO</span>
                    <span className="font-mono font-black text-[#12C7BB]">R$ 99/mês</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Agenda + Aulas & Mensalidades + Tabelas Ilimitadas + Ranking
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('pay_per_table_20')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    selectedPlan === 'pay_per_table_20'
                      ? 'border-[#0987CE] bg-[#030B17] text-white'
                      : 'border-[#145A9B] bg-[#030B17]/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">Tabela Avulsa</span>
                    <span className="font-mono font-black text-[#5BC3FA]">R$ 20/tabela</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Pague apenas quando criar um campeonato oficial na arena
                  </p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-2xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4 fill-white" />
              Criar Minha Arena Agora & Liberar Painel Completo
            </button>
          </form>
        </div>

        {/* ROI Calculator & Multi-Arena Live Switcher (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-[#12C7BB]">
              <TrendingUp className="w-4 h-4" />
              Simulador de Faturamento p/ Dono da Arena
            </div>
            <h3 className="text-lg font-black text-white">
              Veja quanto sua Arena fatura usando o SHARK SET (Custo: R$ 99/mês)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-300 mb-1">
                  <span>Quadras na Arena:</span>
                  <span className="font-mono text-[#5BC3FA]">{simCourts} quadras</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={simCourts}
                  onChange={(e) => setSimCourts(parseInt(e.target.value, 10))}
                  className="w-full accent-[#0987CE] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-300 mb-1">
                  <span>Alunos Matriculados nas Turmas:</span>
                  <span className="font-mono text-[#5BC3FA]">{simStudents} alunos</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={simStudents}
                  onChange={(e) => setSimStudents(parseInt(e.target.value, 10))}
                  className="w-full accent-[#0987CE] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-300 mb-1">
                  <span>Campeonatos por Mês:</span>
                  <span className="font-mono text-[#5BC3FA]">{simTournamentsPerMonth} torneios/mês</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={simTournamentsPerMonth}
                  onChange={(e) => setSimTournamentsPerMonth(parseInt(e.target.value, 10))}
                  className="w-full accent-[#0987CE] cursor-pointer"
                />
              </div>
            </div>

            <div className="aquarium-glass bg-[#030B17] border border-[#145A9B] text-white rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Receita Mensal Movimentada:</span>
                <span className="font-mono font-bold text-[#12C7BB]">
                  R$ {estimatedMonthlyRevenue.toLocaleString('pt-BR')} / mês
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Investimento no Plano Arena PRO:</span>
                <span className="font-mono font-bold text-[#5BC3FA]">Apenas R$ 99,00 / mês</span>
              </div>
            </div>
          </div>

          {/* Active Multi-Tenant Arenas Running Simultaneously */}
          <div className="aquarium-glass bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-6 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white">
                Arenas Operando Simultaneamente ({availableTenants.length})
              </h4>
              <span className="text-[11px] font-bold text-[#12C7BB]">Zero Loading · Multi-Tenant</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {availableTenants.map((ar) => {
                const isCurrent = ar.id === tenant.id;
                return (
                  <button
                    key={ar.id}
                    onClick={() => setTenantId(ar.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-[#12C7BB] bg-[#030B17] text-white'
                        : 'border-[#145A9B] bg-[#030B17]/60 hover:bg-[#030B17] text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-extrabold">{ar.name}</div>
                      <div className="text-[11px] opacity-75">
                        {ar.city} - {ar.state} · {ar.courts.length} quadras
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                        isCurrent ? 'bg-[#0987CE] text-white' : 'bg-[#071D3D] text-slate-300'
                      }`}
                    >
                      {isCurrent ? 'ARENA ATIVA' : 'Alternar'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
