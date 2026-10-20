import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth, db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Court, SportType, TenantConfig } from '../types';
import { toast } from '../store/useToastStore';
import { Building2, MapPin, Phone, Clock, DollarSign, X, Check, Plus, Shield } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (arena: TenantConfig) => void;
}

export const CreateArenaModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const { setAvailableTenants, setTenantId, setActiveTab, setArenaSubTab } = useApp();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Mineiros');
  const [state, setState] = useState('GO');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [courtCount, setCourtCount] = useState(2);
  const [hourlyRate, setHourlyRate] = useState(80);
  const [selectedSports, setSelectedSports] = useState<SportType[]>([
    'futevolei',
    'beach_tennis',
    'volei_praia',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleSport = (sport: SportType) => {
    setSelectedSports((prev) =>
      prev.includes(sport) ? (prev.length > 1 ? prev.filter((s) => s !== sport) : prev) : [...prev, sport]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      const arenaId = `arena-${Date.now()}`;
      const courts: Court[] = Array.from({ length: Math.max(1, courtCount) }, (_, i) => ({
        id: `court-${i + 1}`,
        name: `Quadra ${i + 1}`,
        description: `Quadra ${i + 1} oficial de areia quartzosa com iluminação LED`,
        sports: selectedSports,
        surface: 'Areia Quartzosa Premium',
        isCovered: i === 0,
        hasLighting: true,
        hourlyRate: hourlyRate || 80,
        peakHourlyRate: (hourlyRate || 80) + 20,
        weekendNormalRate: hourlyRate || 80,
        weekendPeakRate: (hourlyRate || 80) + 20,
        peakStartTime: '18:00',
        peakEndTime: '22:00',
        openTime,
        closeTime,
      }));

      const newArena: TenantConfig = {
        id: arenaId,
        name: name.trim(),
        tagline: 'Gestão Esportiva & Agendamento Inteligente',
        city: city.trim(),
        state: state.trim().toUpperCase(),
        address: address.trim() || `${city.trim()} - ${state.trim().toUpperCase()}`,
        distanceKm: 2.5,
        rating: 5.0,
        whatsapp: whatsapp.replace(/\D/g, '') || '5564999990000',
        primaryColor: '#0987CE',
        accentColor: '#FF6B00',
        sandBg: 'linear-gradient(180deg, #0987CE 0%, #031526 100%)',
        amenities: [
          'Ducha aquecida',
          'Vestiário completo',
          'Churrasqueira',
          'Bar e lanchonete',
          'Iluminação LED noturna',
          'Wi-Fi gratuito',
        ],
        courts,
        operatingHours: {
          open: openTime,
          close: closeTime,
        },
        subscriptionPlan: 'arena_pro_99',
        monthlyPlanPrice: 99,
        ownerName: auth.currentUser?.displayName || 'Administrador',
      };

      // Persist in Firestore if online
      if (auth.currentUser) {
        try {
          await setDoc(doc(collection(db, 'arenas'), arenaId), {
            ...newArena,
            ownerId: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // If offline or permission fallback, continue with local state
        }
      }

      // Update state in AppContext
      setAvailableTenants((prev) => [newArena, ...prev]);
      setTenantId(newArena.id);
      setArenaSubTab('agendamentos');
      setActiveTab('scheduler');

      if (onCreated) onCreated(newArena);

      // Trigger Global Toast and automatically close dialog
      toast.success(`Arena "${newArena.name}" cadastrada com sucesso!`);
      onClose();
    } catch {
      toast.error('Erro ao cadastrar arena. Tente novamente.');
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
      <div className="aquarium-glass bg-[#05182C] border border-cyan-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-white space-y-5 animate-in fade-in zoom-in-95 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          <div>
            <label className="block text-slate-300 mb-1">Nome Oficial da Arena *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: SHARK SET Arena Prime"
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
                placeholder="Ex: Mineiros"
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
                placeholder="Ex: GO"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Endereço Completo</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. das Palmeiras, 1200 - Centro"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">WhatsApp de Contato da Arena</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: (64) 99999-1234"
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
                value={courtCount}
                onChange={(e) => setCourtCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Valor Médio / Hora (R$)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min={20}
                  step={5}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Horário de Abertura</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Horário de Fechamento</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#030D1A] border border-cyan-800/60 text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1.5">Modalidades Disponíveis</label>
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
        </form>
      </div>
    </div>
  );
};
