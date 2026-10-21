import { DropdownUI } from './DropdownUI';
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth, getArenaCreationAccess, signInWithGooglePopup } from '../lib/firebase';
import { Court, SportType, TenantConfig } from '../types';
import { toast } from '../store/useToastStore';
import { Building2, MapPin, Phone, Clock, DollarSign, X, Check, Plus, Shield, ArrowRight } from 'lucide-react';
import { AccessLockedAction } from './AccessLockedAction';
import { closeOnBackdrop } from '../utils/dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (arena: TenantConfig) => void;
}

export const CreateArenaModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const { addArena, setTenantId, setActiveTab, setArenaSubTab } = useApp();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [courtCount, setCourtCount] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [selectedSports, setSelectedSports] = useState<SportType[]>([]);
  const [surface, setSurface] = useState<Court['surface'] | ''>('');
  const [isCovered, setIsCovered] = useState<boolean | null>(null);
  const [hasLighting, setHasLighting] = useState<boolean | null>(null);
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
    const courtTotal = Number(courtCount);
    const hourlyRateValue = Number(hourlyRate);
    if (!name.trim() || !city.trim() || !state.trim() || !address.trim() || !whatsapp.trim() ||
      !openTime || !closeTime || !Number.isInteger(courtTotal) || courtTotal < 1 || courtTotal > 12 ||
      !Number.isFinite(hourlyRateValue) || hourlyRateValue < 0 || selectedSports.length === 0 ||
      !surface || isCovered === null || hasLighting === null) {
      toast.error('Preencha os dados reais da arena, das quadras, dos horários e do preço.');
      return;
    }

    setIsSubmitting(true);

    try {
      const arenaId = `arena-${auth.currentUser.uid}-${Date.now()}`;
      const courts: Court[] = Array.from({ length: courtTotal }, (_, i) => ({
        id: `court-${i + 1}`,
        name: `Quadra ${i + 1}`,
        description: '',
        sports: selectedSports,
        surface,
        isCovered,
        hasLighting,
        hourlyRate: hourlyRateValue,
        openTime,
        closeTime,
      }));

      const newArena: TenantConfig = {
        id: arenaId,
        name: name.trim(),
        tagline: '',
        city: city.trim(),
        state: state.trim().toUpperCase(),
        address: address.trim(),
        distanceKm: 0,
        rating: 0,
        whatsapp: whatsapp.replace(/\D/g, ''),
        primaryColor: '#0987CE',
        accentColor: '#FF6B00',
        sandBg: 'linear-gradient(180deg, #0987CE 0%, #031526 100%)',
        amenities: [],
        courts,
        operatingHours: {
          open: openTime,
          close: closeTime,
        },
        ownerId: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || '',
      };

      await addArena(newArena);
      setTenantId(newArena.id);
      setArenaSubTab('agendamentos');
      setActiveTab('scheduler');

      if (onCreated) onCreated(newArena);

      // Trigger Global Toast and automatically close dialog
      toast.success(`Arena "${newArena.name}" salva no Firestore.`);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-arena-title"
      onClick={(event) => closeOnBackdrop(event, onClose)}
    >
      <div className="aquarium-glass bg-[#05182C] border border-cyan-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-white space-y-5 animate-in fade-in zoom-in-95 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
                Adicione sua arena à plataforma oficial SHARKSET
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
            {/* Ícone de escudo elegante com anel e brilho */}
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <Shield size={28} className="drop-shadow" />
            </div>

            {/* Texto de explicação refinado */}
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

            {/* Container dos botões com espaçamento perfeito e responsivo */}
            {accessState !== 'checking' && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-1 w-full max-w-md mx-auto">
                {/* 1. Botão da função original com trava elegante */}
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

                {/* 2. Botão de Ação Direta (Google ou Ver Planos) */}
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
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
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
        ) : <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          <div>
            <label className="block text-slate-300 mb-1">Nome Oficial da Arena *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome usado oficialmente pela arena"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Cidade *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cidade da arena"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Estado (UF) *</label>
              <input
                type="text"
                required
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="UF"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
              <label className="block text-slate-300 mb-1">Endereço Completo *</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Endereço real da arena"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
              <label className="block text-slate-300 mb-1">WhatsApp de Contato da Arena *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp real para contato"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Valor Médio / Hora (R$)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  required
                  min={0}
                  step={5}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Horário de Abertura *</label>
              <input
                type="time"
                required
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Horário de Fechamento *</label>
              <input
                type="time"
                required
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5">Modalidades Disponíveis *</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'futevolei' as SportType, label: 'âš½ Futevôlei' },
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

          <div className="grid grid-cols-3 gap-3">
            <label className="text-slate-300">
              Tipo de areia *
              <DropdownUI required value={surface} onChange={(event) => setSurface(event.target.value as Court['surface'] | '')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option>
                <option value="Areia Fina">Areia Fina</option>
                <option value="Areia Quartzosa Premium">Areia Quartzosa Premium</option>
              </DropdownUI>
            </label>
            <label className="text-slate-300">
              Coberta? *
              <DropdownUI required value={isCovered === null ? '' : String(isCovered)}
                onChange={(event) => setIsCovered(event.target.value === '' ? null : event.target.value === 'true')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option>
              </DropdownUI>
            </label>
            <label className="text-slate-300">
              Tem iluminação? *
              <DropdownUI required value={hasLighting === null ? '' : String(hasLighting)}
                onChange={(event) => setHasLighting(event.target.value === '' ? null : event.target.value === 'true')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option>
              </DropdownUI>
            </label>
          </div>

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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Building2 size={14} />
              <span>{isSubmitting ? 'Cadastrando…' : 'Cadastrar Arena'}</span>
            </button>
          </div>
        </form>}
      </div>
    </div>
  );
};
