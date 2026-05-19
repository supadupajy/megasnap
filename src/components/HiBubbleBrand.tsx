import { useId } from 'react';
import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => {
  const id = useId().replace(/:/g, '');
  const bgId = `hi-bubble-bg-${id}`;
  const bubbleFillId = `hi-bubble-bubble-fill-${id}`;
  const bubbleGlowId = `hi-bubble-bubble-glow-${id}`;
  const rainbowStrokeId = `hi-bubble-rainbow-stroke-${id}`;
  const shadowId = `hi-bubble-shadow-${id}`;

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="하이버블즈 아이콘"
      className={cn('block', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgId} x1="18" y1="12" x2="102" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE066" />
          <stop offset="0.55" stopColor="#FFB703" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <radialGradient id={bubbleFillId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(46 42) rotate(42) scale(58)">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="0.42" stopColor="#FFFDF7" stopOpacity="0.88" />
          <stop offset="0.72" stopColor="#F5FBFF" stopOpacity="0.72" />
          <stop offset="1" stopColor="#DFF4FF" stopOpacity="0.56" />
        </radialGradient>
        <radialGradient id={bubbleGlowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 63) rotate(90) scale(33)">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="0.72" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={rainbowStrokeId} x1="34" y1="45" x2="76" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6EE7FF" />
          <stop offset="0.28" stopColor="#7C9CFF" />
          <stop offset="0.56" stopColor="#D39BFF" />
          <stop offset="0.78" stopColor="#FFC7D9" />
          <stop offset="1" stopColor="#FFF2A8" />
        </linearGradient>
        <filter id={shadowId} x="23" y="24" width="74" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#C97800" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect x="8" y="8" width="104" height="104" rx="28" fill={`url(#${bgId})`} />

      <g filter={`url(#${shadowId})`}>
        <circle cx="60" cy="63" r="33" fill={`url(#${bubbleFillId})`} stroke="#FFFFFF" strokeWidth="2.4" strokeOpacity="0.68" />
        <circle cx="60" cy="63" r="31.2" fill={`url(#${bubbleGlowId})`} />
        <path d="M36 47C42 39.5 52 32.5 66.5 31C70.8 30.5 74.8 31.1 78.4 32.4" fill="none" stroke={`url(#${rainbowStrokeId})`} strokeWidth="4.4" strokeLinecap="round" opacity="0.95" />
        <path d="M33.5 53.5C40.2 43.8 50.4 37.6 62.5 35.7" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeOpacity="0.8" />
        <ellipse cx="48" cy="47" rx="12.5" ry="8" fill="#FFFFFF" opacity="0.86" transform="rotate(-30 48 47)" />
        <ellipse cx="79" cy="80" rx="16" ry="18" fill="#CFF4FF" opacity="0.18" transform="rotate(12 79 80)" />
        <circle cx="82" cy="43" r="3.2" fill="#FFFFFF" opacity="0.78" />
        <circle cx="86.5" cy="38.5" r="1.4" fill="#FFF6C7" opacity="0.9" />
      </g>
    </svg>
  );
};

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
