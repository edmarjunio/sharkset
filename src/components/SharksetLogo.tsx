import logo256 from '../assets/brand/logo-256.png';
import logo512 from '../assets/brand/logo-512.png';
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
      <span className={`inline-flex items-center shrink-0 ${className}`}>
        <img
          src={logo256} srcSet={`${logo256} 256w, ${logo512} 512w`} sizes={`${px}px`}
          alt="SHARKSET"
          width={px}
          height={px}
          className="rounded-full object-contain shrink-0 shark-logo-elevated transition-transform hover:scale-105"
          decoding="async"
        />
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
        src={logo256} srcSet={`${logo256} 256w, ${logo512} 512w`} sizes={`${px}px`}
        alt="SHARKSET"
        width={px}
        height={px}
        className="rounded-full object-contain shrink-0 shark-logo-elevated"
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
