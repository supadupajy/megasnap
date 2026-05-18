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
      <radialGradient id="hi-bubble-drop" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 44) rotate(48) scale(58)">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.58" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#EAF7FF" />
      </radialGradient>
    </defs>

    <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#hi-bubble-bg)" />

    <circle cx="60" cy="60" r="34" fill="url(#hi-bubble-drop)" stroke="#FFFFFF" strokeWidth="3" />
    <ellipse cx="49" cy="45" rx="12" ry="7" fill="#FFFFFF" opacity="0.85" transform="rotate(-35 49 45)" />
    <path d="M82 58C82 73.5 73.5 84 60 88C77 88 92 75.5 92 60C92 48 85.5 38 76 32C79.8 38.8 82 47.8 82 58Z" fill="#DFF5FF" opacity="0.38" />
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
