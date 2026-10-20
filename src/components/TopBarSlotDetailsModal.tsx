import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  X,
  ArrowRight,
  Zap,
  CheckCircle2,
  Phone,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { Court, SportType, TenantConfig } from '../types';
import type { AvailabilityCell } from '../services/bookingAvailability';
import { useApp } from '../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  arena: TenantConfig | null;
  court: Court | null;
  slot: AvailabilityCell | null;
  distanceKm?: number;
  onSelectBooking?: (arena: TenantConfig, slot: AvailabilityCell, court: Court) => void;
  onGoToArena: (arena: TenantConfig) => void;
}

export function TopBarSlotDetailsModal({
  isOpen,
  onClose,
  arena,
  court,
  slot,
  distanceKm,
  onSelectBooking,
  onGoToArena,
}: Props) {
  const { userProfile, createBooking, setActiveTab } = useApp();
  const [logoError, setLogoError] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>('futevolei');
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  useEffect(() => {
    setLogoError(false);
    setBookingSuccess(false);
    setCreatedBookingId(null);
    if (court?.sports?.[0]) {
      setSelectedSport(court.sports[0]);
    }
    if (userProfile.name) {
      setPlayerName(userProfile.name);
    }
    if (userProfile.phone) {
      setPlayerPhone(userProfile.phone);
    }
  }, [arena?.id, court?.id, slot?.id, userProfile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !arena || !slot || !court) return null;

  const sportLabels: Record<SportType, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  const formattedDate = () => {
    try {
      const [year, month, day] = slot.date.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return slot.date;
    }
  };

  const handleInstantSchedule = () => {
    try {
      const nameToUse = playerName.trim() || userProfile.name || 'Atleta SHARK SET';
      const phoneToUse = playerPhone.trim() || userProfile.phone || '';

      const newBooking = createBooking(slot.id, selectedSport, nameToUse, phoneToUse);
      setCreatedBookingId(newBooking.id);
      setBookingSuccess(true);
    } catch {
      // Fallback: se o createBooking por slotId exigir que esteja na arena ativa, delegate para onSelectBooking
      if (onSelectBooking) {
        onSelectBooking(arena, slot, court);
      }
    }
  };

  const cleanArenaPhone = arena.whatsapp?.replace(/\D/g, '') || '';
  const whatsAppUrl = cleanArenaPhone
    ? `https://wa.me/55${cleanArenaPhone}?text=${encodeURIComponent(
        `Olá! Gostaria de confirmar o agendamento na ${arena.name}, ${court.name}, em ${formattedDate()} das ${slot.startTime} às ${slot.endTime} (${sportLabels[selectedSport]}). Valor: R$ ${slot.price.toFixed(2)}.`
      )}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-modal-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-cyan-400/40 bg-[#041529]/95 text-white shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com Logo da Arena e Status */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-400/60 shadow-md flex items-center justify-center shrink-0">
              {arena.logoUrl && !logoError ? (
                <img
                  src={arena.logoUrl}
                  alt={arena.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-xl font-black text-cyan-300">
                  {arena.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Horário Disponível para Agendamento
                </span>
              </div>
              <h3 id="slot-modal-title" className="text-base sm:text-lg font-black text-white leading-tight">
                {arena.name}
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {arena.city}/{arena.state}
                  {Number.isFinite(distanceKm) && distanceKm! > 0 ? ` · ${distanceKm!.toFixed(1)} km` : ''}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar detalhes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificação de Sucesso se acabou de agendar */}
        {bookingSuccess ? (
          <div className="rounded-2xl border border-emerald-400/60 bg-emerald-950/60 p-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/50">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Horário Agendado com Sucesso!</h4>
              <p className="text-xs text-emerald-200 mt-1">
                Sua reserva para <strong>{court.name}</strong> em <strong>{formattedDate()}</strong> às{' '}
                <strong>{slot.startTime}–{slot.endTime}</strong> foi confirmada.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  <MessageCircle size={15} />
                  <span>Avisar Arena no WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setActiveTab('my_bookings');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
              >
                Ver Minhas Reservas
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Bloco de Detalhes da Quadra e do Horário */}
            <div className="rounded-2xl border border-cyan-500/25 bg-[#030D1A]/90 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Quadra Selecionada
                  </span>
                  <strong className="text-sm sm:text-base font-black text-cyan-200">{court.name}</strong>
                  {court.isCovered !== undefined && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {court.isCovered ? 'Quadra Coberta' : 'Quadra Descoberta'} · Areia Tratada
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Valor da Locação
                  </span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    R$ {slot.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Informações de Horário e Data */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Horário</span>
                    <span className="font-mono font-black text-white text-sm">
                      {slot.startTime} às {slot.endTime}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Data</span>
                    <span className="font-bold text-white text-sm">{formattedDate()}</span>
                  </div>
                </div>
              </div>

              {/* Seletor de Modalidade Esportiva */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Modalidade do Jogo:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(court.sports || ['futevolei', 'beach_tennis', 'volei_praia']).map((sport) => {
                    const isSelected = selectedSport === sport;
                    return (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => setSelectedSport(sport)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center truncate ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 border-cyan-300 font-black shadow-md'
                            : 'bg-slate-900/70 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        {sportLabels[sport] || sport}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Identificação rápida do Jogador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Nome do Titular:
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full h-8 px-2.5 rounded-lg bg-[#05182C] border border-cyan-800/60 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    WhatsApp para Confirmação:
                  </label>
                  <input
                    type="tel"
                    value={playerPhone}
                    onChange={(e) => setPlayerPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full h-8 px-2.5 rounded-lg bg-[#05182C] border border-cyan-800/60 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Botões de Ação Principais com AGENDAR AGORA em grande destaque */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleInstantSchedule}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 active:translate-y-0.5 transition-all cursor-pointer border border-emerald-300"
              >
                <Zap className="w-5 h-5 text-slate-950 fill-current" />
                <span>AGENDAR AGORA</span>
              </button>

              <div className="flex gap-2">
                {whatsAppUrl && (
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#052445]/90 hover:bg-[#083566] text-cyan-200 border border-cyan-500/40 text-xs font-bold transition-all text-center"
                  >
                    <MessageCircle size={14} className="text-emerald-400" />
                    <span>WhatsApp da Arena</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToArena(arena);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  <span>Ver Todos os Horários</span>
                  <ArrowRight size={13} className="text-cyan-400" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
