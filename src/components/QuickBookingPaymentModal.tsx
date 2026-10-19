import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SportType, TenantConfig } from '../types';
import { useSharkStore } from '../store/useSharkStore';
import {
  X,
  Check,
  QrCode,
  CreditCard,
  Copy,
  CheckCheck,
  MessageSquare,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface QuickBookingSlotData {
  arena: TenantConfig;
  courtId: string;
  courtName: string;
  date: string;
  time: string; // e.g. "18:00"
  price: number;
  sport?: SportType;
}

interface QuickBookingPaymentModalProps {
  slotData: QuickBookingSlotData | null;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
}

export const QuickBookingPaymentModal: React.FC<QuickBookingPaymentModalProps> = ({
  slotData,
  onClose,
  onSuccess,
}) => {
  const { userProfile, createBooking, setActiveTab } = useApp();
  const pushSmartNotification = useSharkStore((s) => s.pushSmartNotification);

  const [customerName, setCustomerName] = useState(userProfile.name);
  const [customerPhone, setCustomerPhone] = useState(userProfile.phone);
  const [selectedSport, setSelectedSport] = useState<SportType>(slotData?.sport || 'futevolei');
  const [payMethod, setPayMethod] = useState<'pix' | 'cartao'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  if (!slotData) return null;

  const { arena, courtId, courtName, date, time, price } = slotData;

  // Format hour range e.g. "18:00 às 19:00"
  const startHour = parseInt(time.split(':')[0], 10) || 18;
  const endHour = startHour + 1;
  const formattedInterval = `${String(startHour).padStart(2, '0')}:00 às ${String(endHour).padStart(2, '0')}:00`;

  // Simulated unique PIX Code
  const pixCode = `00020126580014br.gov.bcb.pix0136${arena.id}-sharkset-${courtId}-${Date.now()}520400005303986540${price}.005802BR5925${arena.name.slice(0, 25)}6008Mineiros62070503***6304`;

  const handleCopyPix = () => {
    navigator.clipboard?.writeText(pixCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      // Find slot ID or generate valid format
      const slotId = `slot-${courtId}-${date}-${time}`;
      const newBooking = createBooking(slotId, selectedSport, customerName, customerPhone);

      // Trigger Smart Alert
      pushSmartNotification({
        type: 'booking_15min',
        badgeLabel: 'PAGAMENTO CONFIRMADO',
        title: `✅ Horário Reservado: ${arena.name} às ${time}`,
        body: `Parabéns ${customerName}! Seu horário na ${courtName} foi alugado e pago com sucesso no ${payMethod === 'pix' ? 'PIX' : 'Cartão'}.`,
        recipientName: customerName,
        recipientPhone: customerPhone,
        actionLabel: 'Ver Minhas Reservas',
        actionTargetTab: 'my_bookings',
      });

      setIsProcessing(false);
      setConfirmedBookingId(newBooking.id);
      if (onSuccess) {
        onSuccess(newBooking.id);
      }
    }, 600);
  };

  const cleanWhatsapp = (arena.whatsapp || '5564999990001').replace(/\D/g, '');
  const confirmationMsg = encodeURIComponent(
    `Olá ${arena.name}! Acabei de alugar e pagar o horário das ${formattedInterval} no dia ${date} na ${courtName} pelo SHARKSET (Reserva #${confirmedBookingId || 'CONFIRMADA'}). Segue meu comprovante!`
  );
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${confirmationMsg}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#030B17] border-2 border-cyan-500/40 text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#030B17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B00] to-amber-500 flex items-center justify-center shadow-md">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6B00] block">
                CHECKOUT EXPRESS SHARKSET
              </span>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {confirmedBookingId ? 'Reserva Confirmada!' : 'Alugar e Pagar Horário'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {!confirmedBookingId ? (
            <form onSubmit={handleConfirmPayment} className="space-y-4">
              {/* Highlight summary card */}
              <div className="rounded-2xl bg-[#071D3D] border border-cyan-500/30 p-4 space-y-3 shadow-inner">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">{arena.name}</h3>
                    <p className="text-xs font-extrabold text-[#12C7BB] mt-0.5">{courtName}</p>
                    <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      {arena.city}/{arena.state} · {arena.address}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Total a Pagar
                    </span>
                    <span className="text-xl font-black text-emerald-400 font-mono tabular-nums block">
                      R$ {price.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cyan-500/20 text-slate-200">
                  <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-cyan-500/30 font-bold flex items-center gap-1.5 text-cyan-200">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    {date}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 font-mono font-black text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {formattedInterval}
                  </span>
                </div>
              </div>

              {/* Sport Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wide">
                  Qual esporte vai jogar?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'futevolei' as SportType, label: '⚽ Futevôlei' },
                    { id: 'beach_tennis' as SportType, label: '🎾 Beach Tennis' },
                    { id: 'volei_praia' as SportType, label: '🏐 Vôlei Praia' },
                  ].map((sp) => (
                    <button
                      type="button"
                      key={sp.id}
                      onClick={() => setSelectedSport(sp.id)}
                      className={`py-2 px-2 rounded-xl text-center font-black transition-all cursor-pointer border ${
                        selectedSport === sp.id
                          ? 'bg-[#12C7BB] text-slate-950 border-[#12C7BB] shadow-md'
                          : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Info Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">Seu Nome Completo:</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Edmar Júnio"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-300">WhatsApp para Confirmação:</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(64) 99911-2233"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-1">
                <label className="block font-black text-slate-200 uppercase tracking-wide">
                  Escolha como Pagar:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayMethod('pix')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      payMethod === 'pix'
                        ? 'border-emerald-400 bg-emerald-950/60 text-white shadow-md ring-1 ring-emerald-400'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black block text-xs">PIX Instantâneo</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        Aprovação em segundos
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod('cartao')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      payMethod === 'cartao'
                        ? 'border-cyan-400 bg-cyan-950/60 text-white shadow-md ring-1 ring-cyan-400'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black block text-xs">Cartão de Crédito</span>
                      <span className="text-[10px] text-cyan-400 font-semibold">1 Clique</span>
                    </div>
                  </button>
                </div>

                {payMethod === 'pix' && (
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Chave PIX Copia & Cola:
                      </span>
                      <span className="text-emerald-400 font-bold">100% Seguro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={pixCode}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-[10px] text-slate-300 truncate focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        {pixCopied ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar PIX
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Security info */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Horário bloqueado na hora na arena. Comprovante gerado automaticamente.</span>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF6B00] via-orange-500 to-[#FF6B00] hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
                >
                  {isProcessing ? (
                    <span>Processando Reserva...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>PAGAR R$ {price.toFixed(2)} & RESERVAR AGORA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation Screen */
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-300">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  RESERVA CONFIRMADA COM SUCESSO!
                </span>
                <h3 className="text-xl font-black text-white">A quadra está reservada para você!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Horário: <strong>{formattedInterval}</strong> ({date}) na <strong>{courtName}</strong> (
                  {arena.name}).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-xs text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Atleta Titular:</span>
                  <span className="font-bold text-white">{customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Esporte:</span>
                  <span className="font-bold text-white uppercase">{selectedSport}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Forma de Pagamento:</span>
                  <span className="font-bold text-emerald-400 uppercase">{payMethod} Instantâneo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Código da Reserva:</span>
                  <span className="font-mono font-bold text-amber-300">#{confirmedBookingId}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Enviar Comprovante no WhatsApp da Arena</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setActiveTab('my_bookings');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Ver Minhas Reservas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
