import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => (
  <img
    src="/hi-bubble-icon.svg"
    alt="하이버블즈 아이콘"
    className={cn('block object-contain', className)}
    loading="eager"
    decoding="async"
  />
);

export const HiBubbleWordmark = ({ className }: BrandProps) => (
  <div className={cn('inline-flex items-end font-black tracking-[-0.12em] leading-none', className)} aria-label="하이버블즈">
    <span className="text-slate-950">하이</span>
    <span className="ml-1 text-amber-500">버블즈</span>
  </div>
);

export const HiBubbleBrand = ({ className }: BrandProps) => (
  <div className={cn('inline-flex items-center gap-3', className)}>
    <HiBubbleIcon className="h-10 w-10" />
    <HiBubbleWordmark className="text-2xl" />
  </div>
);
