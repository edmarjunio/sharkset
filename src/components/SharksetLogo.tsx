import React from 'react';

interface SharksetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  customPx?: number;
  variant?: 'default' | 'coin3d';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

const sizes = { xs: 28, sm: 38, md: 50, lg: 62, xl: 74, '2xl': 84 };

export const SharksetLogo: React.FC<SharksetLogoProps> = ({
  size = 'md',
  customPx,
  variant = 'default',
  showText = false,
  className = '',
}) => {
  const px = customPx ?? (sizes[size as keyof typeof sizes] || 62);

  if (variant === 'coin3d') {
    return (
      <span className={`shark-coin-stage inline-flex items-center shrink-0 ${className}`}>
        <span
          className="shark-coin-3d shrink-0"
          style={{ width: `${px}px`, height: `${px}px` }}
        >
          {/* 3D Extruded Cylinder Side Layers (exact logo blue/cyan colors) */}
          <span className="shark-coin-edge-back" aria-hidden="true" />
          <span className="shark-coin-edge-mid" aria-hidden="true" />
          {/* Recessed Inner Coin Dish + Raised Outer Rim in Logo Blue */}
          <span className="shark-coin-rim" aria-hidden="true" />
          {/* Popped-out 3D Relief Logo Face */}
          <img
            src="/brand/logo.png"
            alt="SHARKSET"
            width={px}
            height={px}
            className="shark-coin-face rounded-full object-contain shrink-0"
            decoding="async"
          />
          <span className="shark-coin-shine" aria-hidden="true" />
        </span>
        {showText && (
          <span className="font-black tracking-tight ml-3 text-white text-base sm:text-lg">
            SHARK<span className="text-[#FF6B00]">SET</span>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <img
        src="/brand/logo.png"
        alt="SHARKSET"
        width={px}
        height={px}
        className="rounded-full object-contain shrink-0"
        decoding="async"
      />
      {showText && (
        <span className="font-black tracking-tight">
          SHARK<span className="text-[#0987CE]">SET</span>
        </span>
      )}
    </span>
  );
};
