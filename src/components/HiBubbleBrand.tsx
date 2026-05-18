import React from 'react';
import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => (
  <svg
    viewBox="0 0 120 120"
    role="img"
    aria-label="하이버블 아이콘"
    className={cn('block', className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hi-bubble-bg" x1="18" y1="12" x2="102" y2="110" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE066" />
        <stop offset="0.55" stopColor="#FFB703" />
        <stop offset="1" stopColor="#FF8A00" />
      </linearGradient>
      <linearGradient id="hi-bubble-pin" x1="41" y1="24" x2="78" y2="86" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#FFF7E5" />
      </linearGradient>
    </defs>

    <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#hi-bubble-bg)" />
    <path d="M25 37H95M25 56H95M25 75H95M41 24V91M62 24V91M82 24V91" stroke="white" strokeOpacity="0.28" strokeWidth="2.4" strokeLinecap="round" />

    <g>
      <path
        d="M60 26C46.2 26 35 37.2 35 51C35 69.2 55 84.4 59.1 91.6C59.5 92.3 60.5 92.3 60.9 91.6C65 84.4 85 69.2 85 51C85 37.2 73.8 26 60 26Z"
        fill="url(#hi-bubble-pin)"
      />
    </g>

    <g fill="#FFFFFF" stroke="#111827" strokeOpacity="0.1" strokeWidth="1.5">

      <circle cx="82" cy="28" r="7.5" />
      <circle cx="94" cy="38" r="5" />
      <circle cx="31" cy="39" r="4.5" />
      <circle cx="87" cy="68" r="4" />
    </g>
  </svg>
);

export const HiBubbleWordmark = ({ className }: BrandProps) => (
  <div className={cn('relative inline-flex items-end font-black tracking-[-0.12em] leading-none', className)} aria-label="하이버블">
    <span className="text-slate-950">하이</span>
    <span className="relative ml-1 text-amber-500">
      버블
      <span className="absolute -right-3 -top-3 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-sm" />
      <span className="absolute right-4 -top-4 h-1.5 w-1.5 rounded-full bg-sky-300 shadow-sm" />
      <span className="absolute right-0 top-2 h-1 w-1 rounded-full bg-white ring-1 ring-amber-200" />
    </span>
  </div>
);

export const HiBubbleBrand = ({ className }: BrandProps) => (
  <div className={cn('inline-flex items-center gap-2.5', className)}>
    <HiBubbleIcon className="h-9 w-9" />
    <HiBubbleWordmark className="text-2xl" />
  </div>
);
