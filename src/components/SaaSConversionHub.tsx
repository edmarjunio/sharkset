import React from 'react';
import { CreditCard, LockKeyhole } from 'lucide-react';

export const SaaSConversionHub: React.FC = () => (
  <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white sm:px-6 lg:py-12">
    <header className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-200">
        <CreditCard size={15} /> Planos SHARKSET
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Planos e pagamentos</h1>
    </header>

    <section className="aquarium-glass mt-8 rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6 text-center sm:p-8">
      <LockKeyhole className="mx-auto text-amber-200" size={28} />
      <h2 className="mt-4 text-lg font-extrabold text-amber-100">Planos ainda não publicados</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">
        Valores e condições comerciais serão exibidos quando forem configurados e confirmados.
      </p>
    </section>
  </main>
);
