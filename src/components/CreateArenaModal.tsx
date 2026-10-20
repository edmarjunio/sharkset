import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth, getArenaCreationAccess, signInWithGooglePopup } from '../lib/firebase';
import { Court, SportType, TenantConfig } from '../types';
import { toast } from '../store/useToastStore';
import { Building2, MapPin, Phone, Clock, DollarSign, X, Check, Plus, Shield } from 'lucide-react';

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
      setAccessState(access.reason);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-arena-title"
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
          <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5 text-center space-y-3">
            <Shield className="mx-auto text-amber-300" size={28} />
            <p className="text-sm font-bold text-white">
              {accessState === 'checking' ? 'Verificando acesso…' : accessState === 'login'
                ? 'Entre com sua conta para cadastrar uma arena.'
                : 'Para cadastrar uma arena, assine o plano de R$ 99 ou R$ 149, ou solicite uma liberação administrativa.'}
            </p>
            {accessState === 'login' && <button type="button" onClick={() => { setAccessState('checking'); void signInWithGooglePopup().then(({ user }) => getArenaCreationAccess(user.uid)).then((access) => setAccessState(access.allowed ? 'allowed' : access.reason === 'login' ? 'login' : 'plan')).catch(() => setAccessState('login')); }} className="rounded-xl bg-cyan-600 px-4 py-2.5 font-black text-white">Entrar com Google</button>}
            {accessState === 'plan' && <button type="button" onClick={() => { onClose(); setActiveTab('saas_hub'); }} className="rounded-xl bg-amber-400 px-4 py-2.5 font-black text-slate-950">Ver planos</button>}
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
              <select required value={surface} onChange={(event) => setSurface(event.target.value as Court['surface'] | '')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option>
                <option value="Areia Fina">Areia Fina</option>
                <option value="Areia Quartzosa Premium">Areia Quartzosa Premium</option>
              </select>
            </label>
            <label className="text-slate-300">
              Coberta? *
              <select required value={isCovered === null ? '' : String(isCovered)}
                onChange={(event) => setIsCovered(event.target.value === '' ? null : event.target.value === 'true')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option>
              </select>
            </label>
            <label className="text-slate-300">
              Tem iluminação? *
              <select required value={hasLighting === null ? '' : String(hasLighting)}
                onChange={(event) => setHasLighting(event.target.value === '' ? null : event.target.value === 'true')}
                className="mt-1 block w-full rounded-xl bg-[#030D1A] border border-cyan-800/60 p-2 text-white">
                <option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option>
              </select>
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
