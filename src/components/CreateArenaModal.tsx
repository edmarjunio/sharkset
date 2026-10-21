import { DropdownUI } from './DropdownUI';
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth, getArenaCreationAccess, signInWithGooglePopup } from '../lib/firebase';
import { Court, SportType, TenantConfig } from '../types';
import { toast } from '../store/useToastStore';
import { Building2, Phone, Clock, DollarSign, X, Check, Plus, Shield, ArrowRight, ShieldCheck, Flame, Trash2 } from 'lucide-react';
import { AccessLockedAction } from './AccessLockedAction';
import { closeOnBackdrop } from '../utils/dialog';
import { ArenaLocationPicker, ArenaLocationValue } from './ArenaLocationPicker';
import { ArenaWhatsAppVerifier } from './ArenaWhatsAppVerifier';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (arena: TenantConfig) => void;
}

interface PeakIntervalItem {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  label?: string;
}

export const CreateArenaModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const { addArena, setTenantId, setActiveTab, setArenaSubTab } = useApp();

  const [name, setName] = useState('');
  const [location, setLocation] = useState<ArenaLocationValue>({
    cep: '',
    address: '',
    city: '',
    state: '',
    lat: -17.5684,
    lng: -52.5811,
  });

  // WhatsApp and verification
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [showWhatsappVerifier, setShowWhatsappVerifier] = useState(false);

  // Hours: default to 06:00 to 00:00 (midnight)
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('00:00');

  // Courts & Pricing
  const [courtCount, setCourtCount] = useState('2');
  const [hourlyRate, setHourlyRate] = useState('80');

  // Peak Pricing
  const [hasPeakPricing, setHasPeakPricing] = useState(false);
  const [peakIntervals, setPeakIntervals] = useState<PeakIntervalItem[]>([
    { id: 'peak-1', startTime: '18:00', endTime: '22:00', price: 110, label: 'Horário de Pico Noturno' },
  ]);

  const [selectedSports, setSelectedSports] = useState<SportType[]>(['futevolei']);
  const [surface, setSurface] = useState<Court['surface']>('Areia Fina');
  const [isCovered, setIsCovered] = useState<boolean>(false);
  const [hasLighting, setHasLighting] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'login' | 'plan'>('checking');

  useEffect(() => {
    let current = true;
    if (!isOpen) return () => { current = false; };
    const user = auth.currentUser;
    if (!user) {
      setAccessState('login');
      return () => { current = false; };
    }
    setAccessState('checking');
    void getArenaCreationAccess(user.uid)
      .then((access) => { if (current) setAccessState(access.allowed ? 'allowed' : access.reason === 'login' ? 'login' : 'plan'); })
      .catch(() => { if (current) setAccessState('plan'); });
    return () => { current = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSport = (sport: SportType) => {
    setSelectedSports((prev) =>
      prev.includes(sport) ? (prev.length > 1 ? prev.filter((s) => s !== sport) : prev) : [...prev, sport]
    );
  };

  const handleAddPeakInterval = () => {
    const nextNum = peakIntervals.length + 1;
    setPeakIntervals([
      ...peakIntervals,
      {
        id: `peak-${Date.now()}-${nextNum}`,
        startTime: '18:00',
        endTime: '22:00',
        price: Number(hourlyRate) ? Number(hourlyRate) + 20 : 100,
        label: `Intervalo ${nextNum}`,
      },
    ]);
  };

  const handleRemovePeakInterval = (id: string) => {
    setPeakIntervals(peakIntervals.filter((p) => p.id !== id));
  };

  const handleUpdatePeakInterval = (id: string, updates: Partial<PeakIntervalItem>) => {
    setPeakIntervals(
      peakIntervals.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('Entre com sua conta antes de cadastrar uma arena.');
      return;
    }

    const access = await getArenaCreationAccess(auth.currentUser.uid).catch(() => ({ allowed: false, reason: 'plan' as const }));
    if (!access.allowed) {
      toast.error(access.reason === 'login' ? 'Entre com sua conta para cadastrar uma arena.' : 'A criação de arena exige o plano pago de R$ 99 ou R$ 149, ou uma liberação administrativa.');
      setAccessState(access.reason === 'login' ? 'login' : 'plan');
      return;
    }

    if (!whatsappVerified) {
      setShowWhatsappVerifier(true);
      toast.info('Verifique o WhatsApp oficial da arena antes de finalizar o cadastro.');
      return;
    }

    const courtTotal = Number(courtCount);
    const hourlyRateValue = Number(hourlyRate);

    if (
      !name.trim() ||
      !location.city.trim() ||
      !location.state.trim() ||
      !location.address.trim() ||
      !whatsapp.trim() ||
      !openTime ||
      !closeTime ||
      !Number.isInteger(courtTotal) ||
      courtTotal < 1 ||
      courtTotal > 12 ||
      !Number.isFinite(hourlyRateValue) ||
      hourlyRateValue < 0 ||
      selectedSports.length === 0 ||
      !surface
    ) {
      toast.error('Preencha os dados reais da arena, localização, horários e preço.');
      return;
    }

    setIsSubmitting(true);

    try {
      const arenaId = `arena-${auth.currentUser.uid}-${Date.now()}`;
      const primaryPeak = peakIntervals[0];

      const courts: Court[] = Array.from({ length: courtTotal }, (_, i) => ({
        id: `court-${i + 1}`,
        name: `Quadra ${i + 1}`,
        description: '',
        sports: selectedSports,
        surface,
        isCovered,
        hasLighting,
        hourlyRate: hourlyRateValue,
        peakHourlyRate: hasPeakPricing && primaryPeak ? primaryPeak.price : hourlyRateValue,
        peakStartTime: hasPeakPricing && primaryPeak ? primaryPeak.startTime : '18:00',
        peakEndTime: hasPeakPricing && primaryPeak ? primaryPeak.endTime : '22:00',
        openTime,
        closeTime,
      }));

      const newArena: TenantConfig = {
        id: arenaId,
        name: name.trim(),
        tagline: '',
        city: location.city.trim(),
        state: location.state.trim().toUpperCase(),
        address: location.address.trim(),
        cep: location.cep,
        lat: location.lat,
        lng: location.lng,
        distanceKm: 0,
        rating: 5.0,
        whatsapp: whatsapp.replace(/\D/g, ''),
        whatsappVerified: true,
        primaryColor: '#0987CE',
        accentColor: '#FF6B00',
        sandBg: 'linear-gradient(180deg, #0987CE 0%, #031526 100%)',
        amenities: ['Estacionamento', 'Vestiário', 'Ducha', 'Wi-Fi'],
        courts,
        operatingHours: {
          open: openTime,
          close: closeTime,
        },
        defaultHourlyRate: hourlyRateValue,
        hasPeakPricing,
        peakIntervals: hasPeakPricing ? peakIntervals : [],
        ownerId: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || '',
      };

      await addArena(newArena);
      setTenantId(newArena.id);
      setArenaSubTab('agendamentos');
      setActiveTab('scheduler');

      if (onCreated) onCreated(newArena);

      toast.success(`Arena "${newArena.name}" cadastrada com sucesso no SHARKSET!`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a arena no Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockedAction = () => {
    if (accessState === 'login') {
      setAccessState('checking');
      void signInWithGooglePopup()
        .then(({ user }) => getArenaCreationAccess(user.uid))
        .then((access) => setAccessState(access.allowed ? 'allowed' : access.reason === 'login' ? 'login' : 'plan'))
        .catch(() => setAccessState('login'));
      return;
    }

    if (accessState === 'plan') {
      onClose();
      setActiveTab('saas_hub');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-arena-title"
        onClick={(event) => closeOnBackdrop(event, onClose)}
      >
        <div className="aquarium-glass bg-[#05182C] border border-cyan-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl text-white space-y-5 animate-in fade-in zoom-in-95 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#05182C]/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-white/10 -mt-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Building2 size={20} />
              </div>
              <div>
                <h3 id="create-arena-title" className="text-base sm:text-lg font-black text-white">
                  Cadastrar Nova Arena
                </h3>
                <p className="text-[11px] text-slate-300">
                  Adicione sua arena oficial com localização, horários e preços inteligentes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {accessState !== 'allowed' ? (
            <div className="aquarium-glass rounded-2xl border border-amber-400/30 bg-gradient-to-b from-[#071d38]/90 to-[#030d1c]/95 p-6 sm:p-7 text-center space-y-5 shadow-2xl">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
                <Shield size={28} className="drop-shadow" />
              </div>

              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {accessState === 'login' ? 'Identificação Necessária' : 'Assinatura Necessária'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {accessState === 'checking'
                    ? 'Verificando permissões de acesso…'
                    : accessState === 'login'
                    ? 'Para cadastrar e gerenciar sua arena oficialmente no SHARKSET, conecte-se com sua conta Google.'
                    : 'O cadastro de arenas é exclusivo para assinantes dos planos SHARKSET ou gestores autorizados.'}
                </p>
              </div>

              {accessState !== 'checking' && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-1 w-full max-w-md mx-auto">
                  <AccessLockedAction
                    message={accessState === 'login' ? 'Faça login para cadastrar' : 'Assine um plano para cadastrar'}
                    onClick={handleLockedAction}
                    lockType={accessState === 'login' ? 'login' : 'plan'}
                    className="w-full sm:w-auto rounded-xl"
                    previewClassName="w-full sm:w-auto min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-5 py-2.5 font-black text-xs uppercase tracking-wider text-slate-950 border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] inline-flex"
                  >
                    <Building2 size={16} />
                    <span>Cadastrar Nova Arena</span>
                  </AccessLockedAction>

                  {accessState === 'login' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAccessState('checking');
                        void signInWithGooglePopup()
                          .then(({ user }) => getArenaCreationAccess(user.uid))
                          .then((access) => setAccessState(access.allowed ? 'allowed' : access.reason === 'login' ? 'login' : 'plan'))
                          .catch(() => setAccessState('login'));
                      }}
                      className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-lg shadow-white/10 border border-white/80 transition-all cursor-pointer inline-flex items-center justify-center gap-2.5 active:scale-[0.98] shrink-0"
                    >
                      <span>Entrar com Google</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('saas_hub');
                      }}
                      className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 border border-amber-300 transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-[0.98] shrink-0"
                    >
                      <span>Conhecer Planos SHARKSET</span>
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-xs font-bold">
              {/* 1. Nome da Arena */}
              <div>
                <label className="block text-slate-200 mb-1">Nome Oficial da Arena *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Arena SharkSet, Arena Prime Beach"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-bold"
                />
              </div>

              {/* 2. Localização: CEP, Endereço ou Mapa */}
              <ArenaLocationPicker value={location} onChange={setLocation} />

              {/* 3. WhatsApp com Verificação de Segurança Obrigatória */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-200">WhatsApp de Contato da Arena *</label>
                  {whatsappVerified ? (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck size={14} /> Número Verificado
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400 font-bold">
                      Verificação Obrigatória
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={whatsapp}
                      onChange={(e) => {
                        setWhatsapp(e.target.value);
                        setWhatsappVerified(false);
                      }}
                      placeholder="(64) 99999-9999"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10}
                    onClick={() => setShowWhatsappVerifier(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                      whatsappVerified
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-md'
                    }`}
                  >
                    {whatsappVerified ? <Check size={14} /> : <ShieldCheck size={14} />}
                    <span>{whatsappVerified ? 'Verificado' : 'Verificar WhatsApp'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Horários de Abertura e Fechamento (ex: 06:00 às 00:00) */}
              <div className="p-3.5 rounded-2xl bg-[#031326] border border-cyan-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-400" />
                    Horário de Funcionamento
                  </span>
                  <span className="text-[10px] text-slate-300">
                    Abre de manhã até meia-noite
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Abre às *</label>
                    <input
                      type="time"
                      required
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Fecha às *</label>
                    <input
                      type="time"
                      required
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs font-mono"
                    />
                  </div>
                </div>

                {closeTime === '00:00' && (
                  <p className="text-[11px] text-emerald-300 flex items-center gap-1 font-semibold">
                    <Check size={12} /> Arena aberta até meia-noite: o horário de 23:00 às 00:00 estará liberado na grade!
                  </p>
                )}
              </div>

              {/* 5. Preço Base e Horário de Pico com Intervalos Diferenciados */}
              <div className="p-4 rounded-2xl bg-[#031326] border border-cyan-800/60 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-amber-400" />
                    Valor da Hora & Horários de Pico
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Valor Normal da Hora (R$) *</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        required
                        min={0}
                        step={5}
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Pergunta: Tem horário de pico com preço diferente? */}
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Tem horário de pico com preço diferente?
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setHasPeakPricing(true)}
                        className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all border ${
                          hasPeakPricing
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-[#05182C] text-slate-300 border-cyan-800/70 hover:text-white'
                        }`}
                      >
                        🔥 Sim, tem pico
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasPeakPricing(false)}
                        className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all border ${
                          !hasPeakPricing
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                            : 'bg-[#05182C] text-slate-300 border-cyan-800/70 hover:text-white'
                        }`}
                      >
                        Não, valor único
                      </button>
                    </div>
                  </div>
                </div>

                {/* Se Sim: Selecionar o intervalo (ou intervalos) com valor diferente */}
                {hasPeakPricing && (
                  <div className="space-y-2.5 pt-2 border-t border-cyan-900/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <Flame size={13} /> Intervalos de Horário de Pico:
                      </span>
                      <button
                        type="button"
                        onClick={handleAddPeakInterval}
                        className="px-2.5 py-1 rounded-lg bg-cyan-700/50 hover:bg-cyan-600 text-white text-[10px] font-black cursor-pointer transition-all inline-flex items-center gap-1"
                      >
                        <Plus size={12} />
                        <span>Adicionar outro intervalo</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {peakIntervals.map((interval) => (
                        <div
                          key={interval.id}
                          className="p-3 rounded-xl bg-[#051a30] border border-amber-500/40 flex flex-wrap items-center gap-2.5 justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Das</span>
                            <input
                              type="time"
                              required
                              value={interval.startTime}
                              onChange={(e) =>
                                handleUpdatePeakInterval(interval.id, { startTime: e.target.value })
                              }
                              className="px-2 py-1 rounded-lg bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono"
                            />
                            <span className="text-[10px] font-bold text-slate-400">às</span>
                            <input
                              type="time"
                              required
                              value={interval.endTime}
                              onChange={(e) =>
                                handleUpdatePeakInterval(interval.id, { endTime: e.target.value })
                              }
                              className="px-2 py-1 rounded-lg bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-300">Valor (R$):</span>
                            <input
                              type="number"
                              required
                              min={0}
                              step={5}
                              value={interval.price}
                              onChange={(e) =>
                                handleUpdatePeakInterval(interval.id, { price: Number(e.target.value) })
                              }
                              className="w-20 px-2 py-1 rounded-lg bg-[#030D1A] border border-amber-500/50 text-amber-300 text-xs font-mono font-bold"
                            />

                            {peakIntervals.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePeakInterval(interval.id)}
                                title="Remover intervalo"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Quantidade de Quadras e Infraestrutura */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Número de Quadras</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={courtCount}
                    onChange={(e) => setCourtCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Tipo de areia *</label>
                  <DropdownUI
                    required
                    value={surface}
                    onChange={(event) => setSurface(event.target.value as Court['surface'])}
                    className="w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2.5 text-white text-xs"
                  >
                    <option value="Areia Fina">Areia Fina</option>
                    <option value="Areia Quartzosa Premium">Areia Quartzosa Premium</option>
                  </DropdownUI>
                </div>
              </div>

              {/* 7. Modalidades */}
              <div>
                <label className="block text-slate-300 mb-1.5">Modalidades Disponíveis *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'futevolei' as SportType, label: '⚽ Futevôlei' },
                    { id: 'beach_tennis' as SportType, label: '🎾 Beach Tennis' },
                    { id: 'volei_praia' as SportType, label: '🏐 Vôlei de Praia' },
                  ].map((sport) => {
                    const isSelected = selectedSports.includes(sport.id);
                    return (
                      <button
                        key={sport.id}
                        type="button"
                        onClick={() => toggleSport(sport.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                            : 'bg-[#030D1A] text-slate-400 border-slate-700/60'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{sport.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 8. Cobertura & Iluminação */}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-slate-300">
                  Quadra Coberta?
                  <DropdownUI
                    required
                    value={String(isCovered)}
                    onChange={(event) => setIsCovered(event.target.value === 'true')}
                    className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white"
                  >
                    <option value="false">Não (Aberta)</option>
                    <option value="true">Sim (Coberta)</option>
                  </DropdownUI>
                </label>
                <label className="text-slate-300">
                  Possui Iluminação?
                  <DropdownUI
                    required
                    value={String(hasLighting)}
                    onChange={(event) => setHasLighting(event.target.value === 'true')}
                    className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white"
                  >
                    <option value="true">Sim (Com Iluminação)</option>
                    <option value="false">Não</option>
                  </DropdownUI>
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Building2 size={15} />
                  <span>{isSubmitting ? 'Cadastrando…' : 'Finalizar e Cadastrar Arena'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* WhatsApp Verification Modal */}
      <ArenaWhatsAppVerifier
        isOpen={showWhatsappVerifier}
        onClose={() => setShowWhatsappVerifier(false)}
        phoneToVerify={whatsapp}
        onVerified={() => setWhatsappVerified(true)}
      />
    </>
  );
};
