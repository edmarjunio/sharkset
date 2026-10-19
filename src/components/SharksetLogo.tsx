import React from 'react';

interface SharksetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'coin3d';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

const sizes = { xs: 28, sm: 44, md: 56, lg: 72, xl: 96, '2xl': 164 };

export const SharksetLogo: React.FC<SharksetLogoProps> = ({
  size = 'md',
  variant = 'default',
  showText = false,
  className = '',
}) => {
  if (variant === 'coin3d') {
    return (
      <span className={`shark-coin-stage inline-flex items-center shrink-0 ${className}`}>
        <span className="shark-coin-3d">
          {/* 3D Extruded Cylinder Side Layers (exact logo blue/cyan colors) */}
          <span className="shark-coin-edge-back" aria-hidden="true" />
          <span className="shark-coin-edge-mid" aria-hidden="true" />
          {/* Recessed Inner Coin Dish + Raised Outer Rim in Logo Blue */}
          <span className="shark-coin-rim" aria-hidden="true" />
          {/* Popped-out 3D Relief Logo Face */}
          <img
            src="/brand/logo.png"
            alt="SHARKSET"
            width={sizes[size]}
            height={sizes[size]}
            className="shark-coin-face rounded-full object-contain shrink-0"
            decoding="async"
          />
          <span className="shark-coin-shine" aria-hidden="true" />
        </span>
        {showText && (
          <span className="font-black tracking-tight ml-3">
            SHARK<span className="text-[#0987CE]">SET</span>
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
        width={sizes[size]}
        height={sizes[size]}
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
