import React from 'react';

interface SharksetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

const sizes = { xs: 28, sm: 44, md: 56, lg: 72, xl: 96, '2xl': 144 };
export const SharksetLogo: React.FC<SharksetLogoProps> = ({ size = 'md', showText = false, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
    <img src="/brand/logo.png" alt="SHARKSET" width={sizes[size]} height={sizes[size]}
      className="rounded-full object-contain shrink-0" decoding="async" />
    {showText && <span className="font-black tracking-tight">SHARK<span className="text-[#0987CE]">SET</span></span>}
  </span>
);
