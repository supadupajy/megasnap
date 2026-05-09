import { useEffect, useRef, useState, RefObject } from 'react';

/**
 * Collapsing Header 훅
 * 스크롤 위치에 따라 0~1 사이의 진행도(progress)를 반환합니다.
 * - 0: 헤더가 완전히 펼쳐진 상태
 * - 1: 헤더가 완전히 축소된 상태
 */
export function useCollapsingHeader(threshold: number = 80, observeDeps: unknown[] = []) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId = 0;
    let touchStartY = 0;
    let touchStartScrollTop = 0;

    const updateFromScrollTop = (scrollTop: number) => {
      const next = Math.max(0, Math.min(1, scrollTop / threshold));
      setProgress(next);
    };

    const scheduleFromActualScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updateFromScrollTop(el.scrollTop);
        rafId = 0;
      });
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
      touchStartScrollTop = el.scrollTop;
    };

    const onTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const estimatedScrollTop = touchStartScrollTop + (touchStartY - currentY);
      updateFromScrollTop(estimatedScrollTop);
    };

    const onWheel = (event: WheelEvent) => {
      updateFromScrollTop(el.scrollTop + event.deltaY);
    };

    el.addEventListener('scroll', scheduleFromActualScroll, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    scheduleFromActualScroll();

    return () => {
      el.removeEventListener('scroll', scheduleFromActualScroll);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [threshold, ...observeDeps]);

  return { scrollRef: scrollRef as RefObject<HTMLDivElement>, progress };
}