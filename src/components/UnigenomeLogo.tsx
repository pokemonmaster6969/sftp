import React from 'react';

interface UnigenomeLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  variant?: 'full' | 'icon-only' | 'text-only';
}

export default function UnigenomeLogo({ size = 'md', showTagline = false, variant = 'full' }: UnigenomeLogoProps) {
  const sizeMap = {
    sm: { iconSize: 24, textSize: 'text-sm', containerGap: 'gap-2' },
    md: { iconSize: 32, textSize: 'text-base', containerGap: 'gap-3' },
    lg: { iconSize: 48, textSize: 'text-lg', containerGap: 'gap-4' },
  };

  const { iconSize, textSize, containerGap } = sizeMap[size];

  const DNAIcon = (
    <svg
      viewBox="0 0 48 48"
      width={iconSize}
      height={iconSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {/* DNA Helix */}
      <path
        d="M12 8C12 8 16 12 24 12C32 12 36 8 36 8M12 16C12 16 16 20 24 20C32 20 36 16 36 16M12 24C12 24 16 28 24 28C32 28 36 24 36 24M12 32C12 32 16 36 24 36C32 36 36 32 36 32M12 40C12 40 16 44 24 44C32 44 36 40 36 40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-orange-500"
      />
      {/* Connecting bases */}
      <circle cx="18" cy="12" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="30" cy="12" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="18" cy="20" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="30" cy="20" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="18" cy="28" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="30" cy="28" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="18" cy="36" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="30" cy="36" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="18" cy="44" r="2" fill="currentColor" className="text-orange-500" />
      <circle cx="30" cy="44" r="2" fill="currentColor" className="text-orange-500" />
      {/* Base pair connections */}
      <line x1="18" y1="12" x2="30" y2="12" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
      <line x1="18" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
      <line x1="18" y1="28" x2="30" y2="28" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
      <line x1="18" y1="36" x2="30" y2="36" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
      <line x1="18" y1="44" x2="30" y2="44" stroke="currentColor" strokeWidth="1.5" className="text-orange-500" />
    </svg>
  );

  const LogoText = (
    <div className={showTagline ? 'flex-1' : ''}>
      <div className={`font-bold tracking-tight ${textSize} text-primary`}>
        UNI<span className="text-secondary">G</span>ENOME
      </div>
      {showTagline && (
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Leading Genomics Innovations
        </div>
      )}
    </div>
  );

  if (variant === 'icon-only') return DNAIcon;
  if (variant === 'text-only') return LogoText;

  return (
    <div className={`flex items-center ${containerGap} ${showTagline ? 'flex-col' : ''}`}>
      {DNAIcon}
      {LogoText}
    </div>
  );
}
