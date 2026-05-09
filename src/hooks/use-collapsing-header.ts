import { useEffect, useRef, useState, RefObject } from 'react';

/**
 * Collapsing Header 훅
 * 스크롤 위치에 따라 0~1 사이의 진행도(progress)를 반환합니다.
 * - 0: 헤더가 완전히 펼쳐진 상태
 * - 1: 헤더가 완전히 축소된 상태
 *
 * 사용법:
 *   const { scrollRef, progress } = useCollapsingHeader();
 *   <div ref={scrollRef} className="overflow-y-auto"> ... </div>
 *
 * 반환된 progress 값을 보간(interpolation)에 사용해
 * 헤더 높이, 폰트 크기, opacity 등을 동적으로 조절할 수 있습니다.
 */
export function useCollapsingHeader(threshold: number = 80) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId = 0;

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const y = el.scrollTop;
        const next = Math.max(0, Math.min(1, y / threshold));
        setProgress(next);
        rafId = 0;
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    // 초기 상태 계산
    onScroll();

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [threshold]);

  return { scrollRef: scrollRef as RefObject<HTMLDivElement>, progress };
}
