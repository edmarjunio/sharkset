import React from 'react';

interface AccessLockedActionProps {
  message: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  previewClassName?: string;
  messageClassName?: string;
}

export const AccessLockedAction: React.FC<AccessLockedActionProps> = ({
  message,
  children,
  onClick,
  className = '',
  previewClassName = '',
  messageClassName = '',
}) => (
  <span className={`relative isolate inline-flex shrink-0 rounded-xl ${className}`}>
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-flex select-none ${previewClassName}`}
    >
      <span className="inline-flex items-center gap-[inherit] blur-[1.5px] opacity-60">
        {children}
      </span>
    </span>
    {onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-label={message}
        className={`absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-[inherit] border border-white/30 bg-[#04172c]/55 px-2 text-center text-[11px] font-bold leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[1px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] transition-colors hover:bg-[#062341]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${messageClassName}`}
      >
        {message}
      </button>
    ) : (
      <span
        role="status"
        className={`absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border border-white/30 bg-[#04172c]/55 px-2 text-center text-[11px] font-bold leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[1px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${messageClassName}`}
      >
        {message}
      </span>
    )}
  </span>
);
