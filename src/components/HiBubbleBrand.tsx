import { cn } from '@/lib/utils';

type BrandProps = {
  className?: string;
};

export const HiBubbleIcon = ({ className }: BrandProps) => (
  <div
    role="img"
    aria-label="하이버블즈 아이콘"
    className={cn('overflow-hidden rounded-[27%] bg-transparent', className)}
    style={{
      backgroundImage: "url('/hi-bubble-icon.png')",
      backgroundPosition: '50% 47%',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '222% 222%',
      filter: 'saturate(0.86) hue-rotate(-7deg) brightness(1.04)',
    }}
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
    <HiBubbleIcon className="h-8 w-8" />
    <HiBubbleWordmark className="text-2xl" />
  </div>
);
