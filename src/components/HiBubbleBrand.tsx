import React from 'react';
import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => (
  <svg
    viewBox="0 0 120 120"
    role="img"
    aria-label="하이버블즈 아이콘"
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

    <path
      d="M60 25C45.1 25 33 37.1 33 52C33 70.8 54.7 86.3 59.1 94C59.5 94.7 60.5 94.7 60.9 94C65.3 86.3 87 70.8 87 52C87 37.1 74.9 25 60 25Z"
      fill="url(#hi-bubble-pin)"
    />
    <circle cx="60" cy="52" r="13" fill="#111827" />
  </svg>
);

export const HiBubbleWordmark = ({ className }: BrandProps) => (
  <div className={cn('inline-flex items-end font-black tracking-[-0.12em] leading-none', className)} aria-label="하이버블즈">
    <span className="text-slate-950">하이</span>
    <span className="ml-1 text-amber-500">버블즈</span>
  </div>
);

export const HiBubbleBrand = ({ className }: BrandProps) => (
  <div className={cn('inline-flex items-center gap-2.5', className)}>
    <HiBubbleIcon className="h-9 w-9" />
    <HiBubbleWordmark className="text-2xl" />
  </div>
);
