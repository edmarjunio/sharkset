import React, { useCallback, useState } from 'react';
import type { SportType, TenantConfig } from '../types';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import { useModalFocus } from '../hooks/useModalFocus';
import { useApp } from '../context/AppContext';
import { Tag, CheckCircle2, AlertCircle } from 'lucide-react';

export interface QuickBookingSlotData {
  arena: TenantConfig;
  courtId: string;
  courtName: string;
  date: string;
  time: string;
  endTime?: string;
  price: number;
  sport?: SportType;
}

interface Props {
  slotData: QuickBookingSlotData | null;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
}

export function QuickBookingPaymentModal({ slotData, onClose }: Props) {
  return slotData ? (
    <BookingReview
      key={`${slotData.arena.id}-${slotData.courtId}-${slotData.date}-${slotData.time}`}
      data={slotData}
      onClose={onClose}
    />
  ) : null;
}

function BookingReview({ data, onClose }: { data: QuickBookingSlotData; onClose: () => void }) {
  const close = useCallback(onClose, [onClose]);
  const ref = useModalFocus(close);
  const { applyCouponToBooking } = useApp();
  const { cells, loading, error } = useArenaAvailability(data.arena, data.date);
  const court = data.arena.courts.find((c) => c.id === data.courtId);
  const [sport, setSport] = useState<SportType>(data.sport || court?.sports[0] || 'futevolei');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    discountAmount: number;
    finalPrice: number;
    message: string;
    code?: string;
  } | null>(null);

  const slot = cells.find((c) => c.courtId === data.courtId && c.startTime === data.time);
  const available = slot?.state === 'free';
  const basePrice = slot?.price ?? data.price;
  const finalPrice = couponResult?.valid ? couponResult.finalPrice : basePrice;

  const phone = data.arena.whatsapp?.replace(/\D/g, '');

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    try {
      const res = await applyCouponToBooking({
        code: couponCode.trim(),
        arenaId: data.arena.id,
        originalPrice: basePrice,
      });
      setCouponResult({
        ...res,
        code: couponCode.trim().toUpperCase(),
      });
    } catch {
      setCouponResult({
        valid: false,
        discountAmount: 0,
        finalPrice: basePrice,
        message: 'Erro ao validar o cupom. Tente novamente.',
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const couponDetailText = couponResult?.valid
    ? ` com cupom ${couponResult.code} (desconto de R$ ${couponResult.discountAmount.toFixed(2)})`
    : '';

  const contact =
    phone && /^\d{10,15}$/.test(phone) && available && !BOOKING_DEMO
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          `Olá! Gostaria de consultar a reserva na ${data.arena.name}, ${data.courtName}, em ${data.date}, ${
            slot?.startTime || data.time
          }–${slot?.endTime || data.endTime}, ${sport}. Valor: R$ ${finalPrice.toFixed(2)}${couponDetailText}. Pode confirmar disponibilidade e pagamento?`
        )}`
      : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="booking-review-title"
      className="m-auto w-[95vw] max-w-lg rounded-3xl border border-cyan-700 bg-slate-950 p-6 text-white backdrop:bg-black/75 shadow-2xl"
    >
      <header className="flex justify-between items-center pb-3 border-b border-cyan-900/60">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
            Reserva de Horário
          </span>
          <h2 id="booking-review-title" className="font-black text-xl text-white">
            Revisar Agendamento
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar reserva"
          className="text-slate-400 hover:text-white p-1 text-sm font-bold cursor-pointer"
        >
          ✕
        </button>
      </header>

      <div className="space-y-4 mt-4 text-sm">
        <div className="p-3.5 rounded-2xl bg-[#031527] border border-cyan-800/60">
          <p className="font-bold text-white text-base">
            {data.arena.name} · {data.courtName}
          </p>
          <p className="text-slate-300 text-xs mt-1">
            📅 {data.date.split('-').reverse().join('/')} · ⏰ {data.time} – {slot?.endTime || data.endTime}
          </p>
        </div>

        {loading ? (
          <p role="status" className="text-cyan-300 text-xs">
            Revalidando disponibilidade da quadra…
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-400 text-xs">
            {error}
          </p>
        ) : !available ? (
          <p role="alert" className="text-amber-300 text-xs">
            Este horário não está mais disponível. Escolha outro horário no calendário.
          </p>
        ) : (
          <>
            {/* Price & Coupon Section */}
            <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-700/50 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-300 font-semibold">Valor da Quadra:</span>
                <div className="text-right">
                  {couponResult?.valid && (
                    <span className="text-xs text-slate-400 line-through mr-2 font-mono">
                      R$ {basePrice.toFixed(2)}
                    </span>
                  )}
                  <span className="text-emerald-300 text-2xl font-black font-mono">
                    R$ {finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Coupon Input Form */}
              <form onSubmit={handleApplyCoupon} className="pt-2 border-t border-cyan-900/60">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Cupom de Desconto (Arena ou Global)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ex: SHARK10 ou VERAO"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shrink-0"
                  >
                    {couponLoading ? 'Aplicando…' : 'Aplicar'}
                  </button>
                </div>

                {couponResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      couponResult.valid
                        ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {couponResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{couponResult.message}</span>
                  </div>
                )}
              </form>
            </div>

            <label className="block text-xs font-semibold text-slate-300">
              Modalidade
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as SportType)}
                className="block w-full mt-1.5 rounded-xl bg-slate-900 border border-cyan-800 p-2 text-white font-medium"
              >
                {court?.sports.map((s) => (
                  <option key={s} value={s}>
                    {s === 'futevolei'
                      ? 'Futevôlei'
                      : s === 'beach_tennis'
                      ? 'Beach Tennis'
                      : 'Vôlei de praia'}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <p className="rounded-xl bg-amber-950/70 border border-amber-800/50 p-3 text-amber-200 text-xs" role="status">
          {BOOKING_DEMO
            ? 'Demonstração com dados locais. Nenhuma cobrança real será realizada.'
            : 'A confirmação final do horário e recebimento são efetuados diretamente com a arena via WhatsApp.'}
        </p>

        {contact ? (
          <a
            href={contact}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 p-3 text-center font-black text-white text-sm shadow-lg cursor-pointer transition-all active:scale-[0.98]"
          >
            Consultar Reserva no WhatsApp ({couponResult?.valid ? `R$ ${finalPrice.toFixed(2)} c/ Desconto` : `R$ ${finalPrice.toFixed(2)}`})
          </a>
        ) : (
          <button disabled className="w-full rounded-xl bg-slate-800 p-3 text-slate-400 text-xs">
            Indisponível para reserva imediata
          </button>
        )}
      </div>
    </dialog>
  );
}
