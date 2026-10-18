import React from 'react';

interface SharksetLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const SharksetLogo: React.FC<SharksetLogoProps> = ({
  size = 'md',
  showText = false,
  showSubtitle = false,
  className = '',
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-36 h-36',
  };

  const badgeSize = sizeMap[size] || 'w-11 h-11';

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <div className="inline-flex items-center gap-2">
        {/* High-fidelity Vector SVG reproducing the Sharkset Emblem from Brand Guidelines */}
        <svg
          viewBox="0 0 200 200"
          className={`${badgeSize} shrink-0 drop-shadow-[0_4px_12px_rgba(9,135,206,0.35)]`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Sharkset Emblema Oficial"
        >
          <defs>
            {/* Ring Gradients */}
            <linearGradient id="ringNavy" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0B2B5C" />
              <stop offset="50%" stopColor="#071D3D" />
              <stop offset="100%" stopColor="#030C1A" />
            </linearGradient>

            <linearGradient id="ringLightBorder" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#12C7BB" />
              <stop offset="50%" stopColor="#0987CE" />
              <stop offset="100%" stopColor="#071D3D" />
            </linearGradient>

            <linearGradient id="sunGrad" x1="100" y1="40" x2="100" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#12C7BB" />
              <stop offset="100%" stopColor="#0987CE" />
            </linearGradient>
          </defs>

          {/* Outer Circular Border Trim */}
          <circle cx="100" cy="100" r="97" stroke="url(#ringLightBorder)" strokeWidth="4" />
          <circle cx="100" cy="100" r="94" fill="url(#ringNavy)" />

          {/* Inner Sky & Net Canvas */}
          <circle cx="100" cy="100" r="76" fill="#0A254D" />

          {/* Sun in Background */}
          <circle cx="100" cy="80" r="42" fill="url(#sunGrad)" />

          {/* Beach Net Pattern */}
          <g stroke="#0987CE" strokeWidth="1.6" opacity="0.45">
            <line x1="42" y1="80" x2="158" y2="80" />
            <line x1="38" y1="92" x2="162" y2="92" />
            <line x1="36" y1="104" x2="164" y2="104" />
            <line x1="36" y1="116" x2="164" y2="116" />
            <line x1="56" y1="70" x2="56" y2="125" />
            <line x1="74" y1="65" x2="74" y2="125" />
            <line x1="92" y1="60" x2="92" y2="125" />
            <line x1="110" y1="60" x2="110" y2="125" />
            <line x1="128" y1="65" x2="128" y2="125" />
            <line x1="146" y1="70" x2="146" y2="125" />
          </g>

          {/* Net Top White Cable */}
          <path d="M 32 80 Q 100 86 168 80" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />

          {/* Shark Mascot */}
          {/* Dorsal Fin */}
          <path
            d="M 72 65 C 78 40 92 48 94 62 Z"
            fill="#0B4B82"
            stroke="#5BC3FA"
            strokeWidth="1.2"
          />

          {/* Shark Main Body */}
          <path
            d="M 45 106 C 52 82 85 64 125 72 C 150 78 166 95 158 110 C 145 125 108 126 84 125 C 65 123 48 116 45 106 Z"
            fill="url(#sharkBody)"
          />

          {/* Shark Underbelly (White) */}
          <path
            d="M 85 110 C 105 110 135 116 150 106 C 144 116 126 123 98 123 C 80 123 68 118 85 110 Z"
            fill="#F7FAFD"
          />

          {/* Pectoral Fin */}
          <path
            d="M 86 112 C 82 128 98 136 108 120 C 100 114 93 112 86 112 Z"
            fill="#0B4B82"
            stroke="#12C7BB"
            strokeWidth="1.2"
          />

          {/* Shark Gills */}
          <path d="M 98 88 Q 100 95 98 102" stroke="#071D3D" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 103 88 Q 105 95 103 101" stroke="#071D3D" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 108 89 Q 110 95 108 100" stroke="#071D3D" strokeWidth="1.8" strokeLinecap="round" />

          {/* Eye */}
          <ellipse cx="128" cy="85" rx="5" ry="4.5" fill="#FFFFFF" />
          <circle cx="129" cy="85" r="2.8" fill="#071D3D" />
          <circle cx="130" cy="84" r="1" fill="#FFFFFF" />
          {/* Brow (Determined expression) */}
          <path d="M 122 81 C 126 78 133 80 136 83" stroke="#071D3D" strokeWidth="2.2" strokeLinecap="round" />

          {/* Smile / Mouth */}
          <path d="M 118 97 Q 134 103 148 93" stroke="#071D3D" strokeWidth="2.2" strokeLinecap="round" />

          {/* Futevolei Ball in White & Blue */}
          <g id="futevoleiBall">
            <circle cx="120" cy="140" r="21" fill="#F7FAFD" stroke="#0987CE" strokeWidth="2.5" />
            {/* Star / Pattern */}
            <polygon
              points="120,126 123,134 131,134 125,139 127,147 120,142 113,147 115,139 109,134 117,134"
              fill="#0987CE"
            />
            {/* Subtle Ball Seam Lines */}
            <path d="M 101 136 Q 120 144 139 134" stroke="#071D3D" strokeWidth="1.5" fill="none" />
            <path d="M 108 152 Q 120 142 134 153" stroke="#071D3D" strokeWidth="1.5" fill="none" />
          </g>

          {/* Dynamic Ocean Waves in Foreground */}
          {/* Deep Wave Base */}
          <path
            d="M 28 125 C 40 105 60 115 70 135 C 80 155 105 168 135 164 C 160 160 174 140 178 130 C 180 155 162 180 130 184 C 90 190 40 175 28 125 Z"
            fill="url(#waveDeep)"
          />

          {/* Crest Wave Turquoise */}
          <path
            d="M 24 135 C 32 112 55 110 68 130 C 82 152 108 165 140 160 C 120 176 80 180 50 165 C 32 155 26 142 24 135 Z"
            fill="url(#waveLight)"
          />

          {/* Seafoam Splashes */}
          <circle cx="56" cy="115" r="3" fill="#F7FAFD" />
          <circle cx="68" cy="108" r="2.2" fill="#F7FAFD" />
          <circle cx="145" cy="128" r="2.5" fill="#12C7BB" />
          <circle cx="156" cy="132" r="2" fill="#F7FAFD" />
          <circle cx="162" cy="124" r="2.8" fill="#12C7BB" />

          {/* Circular Frame Accent Ring */}
          <circle cx="100" cy="100" r="88" stroke="#12C7BB" strokeWidth="1.8" strokeDasharray="300" strokeDashoffset="40" />

          {/* Arched Top Brand Text: SHARKSET */}
          <text
            fill="#F7FAFD"
            fontSize="23"
            fontWeight="900"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            letterSpacing="5"
            filter="drop-shadow(0px 2px 4px rgba(3, 11, 23, 0.9))"
          >
            <textPath
              href="#textArcPath"
              startOffset="50%"
              textAnchor="middle"
            >
              SHARKSET
            </textPath>
          </text>
        </svg>

        {/* Optional Side Typographic Lockup */}
        {showText && (
          <div className="leading-none text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-white font-sans">
                SHARK<span className="text-[#0987CE]">SET</span>
              </span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#12C7BB] block mt-0.5">
              É O TUBA 🦈
            </span>
          </div>
        )}
      </div>

      {showSubtitle && (
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#12C7BB] text-center block mt-1 drop-shadow-xs">
          É O TUBA 🦈
        </span>
      )}
    </div>
  );
};
