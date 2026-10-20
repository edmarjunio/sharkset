import React from 'react';
import { Building2, Check, CreditCard, LockKeyhole, Trophy } from 'lucide-react';

const plans = [
  {
    id: 'arena-two-courts',
    title: 'Arena Essencial',
    price: 'R$ 99,90',
    period: '/ mês',
    description: 'Para arenas com até 2 quadras cadastradas.',
    icon: Building2,
    features: ['Assinatura mensal', 'Limite de até 2 quadras'],
  },
  {
    id: 'arena-unlimited',
    title: 'Arena Ilimitada',
    price: 'R$ 149,90',
    period: '/ mês',
    description: 'Para arenas que precisam cadastrar mais de 2 quadras.',
    icon: Building2,
    features: ['Assinatura mensal', 'Quadras ilimitadas'],
    featured: true,
  },
  {
    id: 'tournament',
    title: 'Campeonato',
    price: 'R$ 19,90',
    period: '/ campeonato',
    description: 'Pagamento único por campeonato. Disponível para qualquer usuário cadastrado.',
    icon: Trophy,
    features: ['Cobrança avulsa', 'Criação liberada após confirmação do pagamento'],
  },
] as const;

export const SaaSConversionHub: React.FC = () => (
  <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white sm:px-6 lg:py-12">
    <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-200">
        <CreditCard size={15} /> Planos SHARKSET
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Escolha o plano para sua arena ou campeonato</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
        Preços em reais. As arenas são cobradas mensalmente; a criação de campeonato tem cobrança única.
      </p>
    </header>

    <section aria-label="Planos e preços" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 md:gap-5">
      {plans.map((plan) => {
        const Icon = plan.icon;
        return (
          <article
            key={plan.id}
            className={`aquarium-glass flex flex-col rounded-3xl border bg-[#071D3D]/95 p-5 shadow-xl sm:p-6 ${
              'featured' in plan && plan.featured
                ? 'border-2 border-[#12C7BB] shadow-cyan-950/30'
                : 'border-[#145A9B]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Icon size={22} />
              </div>
              {'featured' in plan && plan.featured && (
                <span className="rounded-full bg-[#12C7BB] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                  Mais espaço
                </span>
              )}
            </div>

            <h2 className="mt-5 text-xl font-black">{plan.title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-relaxed text-slate-300">{plan.description}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-2 border-t border-white/10 pt-5">
              <span className="text-3xl font-black tracking-tight sm:text-4xl">{plan.price}</span>
              <span className="text-sm font-semibold text-slate-300">{plan.period}</span>
            </div>

            <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-200">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check size={17} className="mt-0.5 shrink-0 text-[#12C7BB]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled
              title="Checkout indisponível até a configuração da conta e dos webhooks de pagamento."
              className="mt-7 inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-500/40 bg-slate-800/80 px-4 py-3 text-sm font-extrabold text-slate-300 opacity-80"
            >
              <LockKeyhole size={16} /> Checkout em configuração
            </button>
          </article>
        );
      })}
    </section>

    <aside className="mx-auto mt-7 max-w-4xl rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100 sm:mt-8 sm:p-5">
      <strong className="font-extrabold">Contratação ainda não ativada.</strong> O checkout só será liberado quando a conta recebedora do SHARKSET estiver configurada e o backend confirmar pagamentos por webhook. Voltar do checkout ou exibir um comprovante na tela não libera o plano.
    </aside>
  </main>
);
