import React from 'react';
import { Lock, Sparkles } from 'lucide-react';

export interface AccessLockedActionProps {
  message: React.ReactNode;
  accessibleMessage?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  previewClassName?: string;
  messageClassName?: string;
  title?: string;
  icon?: React.ReactNode;
  lockType?: 'login' | 'plan' | 'auto';
}

export const AccessLockedAction: React.FC<AccessLockedActionProps> = ({
  message,
  accessibleMessage,
  children,
  onClick,
  className = '',
  previewClassName = '',
  messageClassName = '',
  title,
  icon,
  lockType = 'auto',
}) => {
  const isClickable = Boolean(onClick);
  const Component = isClickable ? 'button' : 'div';

  const textMessage =
    typeof message === 'string'
      ? message
      : typeof accessibleMessage === 'string'
      ? accessibleMessage
      : '';

  const isPlan =
    lockType === 'plan' ||
    (lockType !== 'login' &&
      /assine|plano|assinatura|mensalidade|upgrade/i.test(textMessage));

  const defaultIcon = isPlan ? (
    <Sparkles
      size={12}
      className="shrink-0 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      aria-hidden="true"
    />
  ) : (
    <Lock
      size={12}
      className="shrink-0 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      aria-hidden="true"
    />
  );

  const activeIcon = icon !== undefined ? icon : defaultIcon;
  const tooltip = title || accessibleMessage || (typeof message === 'string' ? message : undefined);

  // Garante contorno sempre nítido no botão se nenhuma borda estiver declarada
  const hasBorder = previewClassName.includes('border') || className.includes('border');
  const borderFallback = hasBorder ? '' : 'border border-white/25';

  return (
    <Component
      {...(isClickable ? { type: 'button', onClick } : { role: 'status' })}
      aria-label={accessibleMessage ?? (typeof message === 'string' ? message : undefined)}
      title={tooltip}
      className={`group relative isolate inline-grid grid-cols-1 items-center justify-items-center overflow-hidden shrink-0 transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
        isClickable ? 'cursor-pointer active:scale-[0.98] hover:brightness-105' : ''
      } ${borderFallback} ${previewClassName} ${className}`}
      style={{ display: 'inline-grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
    >
      {/* 1. Camada original embaçada por baixo (mantém cores, ícones e layout do botão original) */}
      <span
        aria-hidden="true"
        className="col-start-1 row-start-1 w-full h-full pointer-events-none inline-flex items-center justify-center gap-[inherit] select-none filter blur-[2px] opacity-45 scale-[0.98] transition-transform duration-200 group-hover:scale-100"
        style={{ gridArea: '1 / 1' }}
      >
        {children}
      </span>

      {/* 2. Película de vidro fumê frontal que cobre 100% do botão de ponta a ponta (elimina qualquer faixa preta interna) */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-10 pointer-events-none bg-black/35 backdrop-blur-[2px] transition-colors duration-200 group-hover:bg-black/20"
      />

      {/* 3. Aviso nítido com ícone perfeitamente alinhado e integrado ao botão */}
      <span
        className={`col-start-1 row-start-1 z-20 w-full h-full min-w-0 flex items-center justify-center gap-1.5 ${messageClassName}`}
        style={{ gridArea: '1 / 1' }}
      >
        {activeIcon}
        <span className="min-w-0 max-w-full font-black text-[11px] sm:text-xs tracking-normal sm:tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap text-center truncate">
          {message}
        </span>
      </span>
    </Component>
  );
};
