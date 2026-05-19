import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => (
  <div
    role="img"
    aria-label="하이버블즈 아이콘"
    className={cn(
      'relative isolate overflow-hidden rounded-[27%] shadow-[0_14px_28px_rgba(249,115,22,0.22),0_10px_20px_rgba(15,23,42,0.12)]',
      className,
    )}
  >
    <img
      src="/hi-bubble-icon.png"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[49%] h-full w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.84] object-contain select-none"
      loading="eager"
      decoding="async"
    />
  </div>
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
