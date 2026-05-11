import { cn } from '@/lib/utils';

interface ImageSliderDotsProps {
  count: number;
  currentIndex: number;
  /** 활성 도트 너비 클래스 (예: 'w-4', 'w-6') */
  activeWidthClass?: string;
  /** 비활성 도트 색상 클래스 (예: 'bg-white/50', 'bg-white/40') */
  inactiveColorClass?: string;
  /** 도트 컨테이너의 bottom 위치 클래스 (예: 'bottom-4', 'bottom-6') */
  bottomClass?: string;
  /** 도트 컨테이너의 z-index 클래스 (예: 'z-20', 'z-30') */
  zIndexClass?: string;
}

const ImageSliderDots = ({
  count,
  currentIndex,
  activeWidthClass = 'w-4',
  inactiveColorClass = 'bg-white/50',
  bottomClass = 'bottom-4',
  zIndexClass = 'z-20',
}: ImageSliderDotsProps) => {
  if (count <= 1) return null;

  return (
    <div
      className={cn(
        'absolute left-0 right-0 flex justify-center gap-1.5 pointer-events-none',
        bottomClass,
        zIndexClass
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            currentIndex === i ? `${activeWidthClass} bg-white shadow-sm` : `w-1.5 ${inactiveColorClass}`
          )}
        />
      ))}
    </div>
  );
};

export default ImageSliderDots;
