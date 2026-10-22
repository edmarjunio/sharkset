import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Tag, X } from 'lucide-react';
import { db } from '../lib/firebase';

interface PublicPromotion {
  id: string;
  code: string;
  title: string;
  message: string;
  expiresAt: string | null;
}

function isPromotionActive(promotion: PublicPromotion, now: number): boolean {
  if (!promotion.id || !promotion.code || !promotion.title || !promotion.message) return false;
  if (!promotion.expiresAt) return true;
  const expiration = Date.parse(promotion.expiresAt);
  return Number.isFinite(expiration) && expiration > now;
}

export const PinnedCouponBanner: React.FC = () => {
  const [promotion, setPromotion] = useState<PublicPromotion | null>(null);
  const [dismissedId, setDismissedId] = useState('');

  useEffect(() => onSnapshot(collection(db, 'public_promotions'), (snapshot) => {
    const now = Date.now();
    const next = snapshot.docs
      .map((item) => ({ ...item.data(), id: item.id } as PublicPromotion))
      .find((item) => isPromotionActive(item, now)) || null;
    setPromotion(next);
  }, () => setPromotion(null)), []);

  useEffect(() => {
    if (!promotion?.expiresAt) return;
    const remaining = Date.parse(promotion.expiresAt) - Date.now();
    if (remaining <= 0) return setPromotion(null);
    const timeout = window.setTimeout(() => setPromotion(null), Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [promotion?.id, promotion?.expiresAt]);

  if (!promotion || dismissedId === promotion.id || !isPromotionActive(promotion, Date.now())) return null;

  return (
    <aside
      aria-label="Cupom promocional"
      className="relative z-30 border-y border-amber-300/50 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-3 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 pr-8 text-center sm:pr-10">
        <Tag size={19} className="shrink-0" aria-hidden="true" />
        <div>
          <strong className="block text-sm font-black uppercase tracking-wide sm:text-base">{promotion.title}</strong>
          <span className="text-xs font-bold sm:text-sm">{promotion.message}</span>
        </div>
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(promotion.code); }}
          className="rounded-lg border border-white/70 bg-slate-950/20 px-3 py-1.5 font-mono text-xs font-black tracking-wider hover:bg-slate-950/35"
          aria-label={`Copiar código ${promotion.code}`}
        >
          {promotion.code}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDismissedId(promotion.id)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/15"
        aria-label="Fechar aviso promocional"
      >
        <X size={17} />
      </button>
    </aside>
  );
};
