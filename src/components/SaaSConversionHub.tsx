import React from 'react';
import { CreditCard, LockKeyhole, CheckCircle2, ShieldCheck } from 'lucide-react';

export const SaaSConversionHub: React.FC = () => (
  <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white sm:px-6 lg:py-12">
    <header className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-200">
        <CreditCard size={15} /> Planos SHARKSET
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Planos e pagamentos</h1>
    </header>

    <section className="aquarium-glass mt-8 rounded-3xl border border-cyan-300/30 bg-[#071D3D]/90 p-6 sm:p-8">
      <div className="text-center">
        <LockKeyhole className="mx-auto text-cyan-200" size={28} />
        <h2 className="mt-4 text-lg font-extrabold text-white">Planos para criar sua arena</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">
          A criação de arenas é liberada para assinantes dos planos pagos ou por autorização administrativa.
        </p>
      </div>
      <div className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
        {[99, 149].map((price) => <article key={price} className="rounded-2xl border border-cyan-300/25 bg-slate-950/50 p-5 text-center">
          <span className="text-xs font-black uppercase tracking-widest text-cyan-200">Plano Arena</span>
          <p className="mt-2 text-3xl font-black text-white">R$ {price}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300"><CheckCircle2 size={14} />Criação e gestão de arena</p>
        </article>)}
      </div>
      <div className="mx-auto mt-5 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
        <ShieldCheck className="mt-0.5 shrink-0 text-amber-200" size={18} />
        <p>Após a confirmação da assinatura, o acesso precisa estar ativo na conta. O administrador também pode liberar o cadastro manualmente.</p>
      </div>
    </section>
  </main>
);
