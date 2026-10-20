import React from 'react';
import { useToastStore, ToastType } from '../store/useToastStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const toastConfig: Record<
  ToastType,
  {
    bg: string;
    border: string;
    shadow: string;
    icon: React.FC<{ size?: number; className?: string }>;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    defaultTitle: string;
  }
> = {
  success: {
    bg: 'bg-[#041c2c]/95',
    border: 'border-emerald-400/60',
    shadow: 'shadow-[0_8px_30px_rgba(16,185,129,0.35)]',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    badgeText: 'SUCESSO',
    defaultTitle: 'Ação Realizada',
  },
  error: {
    bg: 'bg-[#1e070c]/95',
    border: 'border-rose-500/60',
    shadow: 'shadow-[0_8px_30px_rgba(244,63,94,0.35)]',
    icon: AlertCircle,
    iconColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    badgeText: 'ATENÇÃO',
    defaultTitle: 'Falha na Operação',
  },
  warning: {
    bg: 'bg-[#1c1304]/95',
    border: 'border-amber-400/60',
    shadow: 'shadow-[0_8px_30px_rgba(245,158,11,0.35)]',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    badgeText: 'AVISO',
    defaultTitle: 'Alerta do Sistema',
  },
  info: {
    bg: 'bg-[#051c33]/95',
    border: 'border-cyan-400/60',
    shadow: 'shadow-[0_8px_30px_rgba(18,199,187,0.35)]',
    icon: Info,
    iconColor: 'text-[#12C7BB]',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    badgeText: 'INFORMAÇÃO',
    defaultTitle: 'Notificação',
  },
};

export const GlobalToast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notificações globais do sistema"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-2 sm:px-0"
    >
      {toasts.map((item) => {
        const config = toastConfig[item.type] || toastConfig.info;
        const Icon = config.icon;

        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl ${config.bg} ${config.border} border ${config.shadow} backdrop-blur-xl text-white transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
          >
            <div className={`p-1.5 rounded-xl ${config.badgeBg} shrink-0 mt-0.5 border`}>
              <Icon size={18} className={config.iconColor} />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider border ${config.badgeBg}`}
                >
                  {config.badgeText}
                </span>
                <h4 className="text-xs font-black text-white truncate">
                  {item.title || config.defaultTitle}
                </h4>
              </div>
              <p className="text-xs font-semibold text-slate-200 leading-snug break-words">
                {item.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              aria-label="Fechar notificação"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </aside>
  );
};
