import { useRef, useState, useCallback } from 'react';

/**
 * 가로 스크롤 이미지 슬라이더용 드래그 + 인덱스 추적 훅.
 *
 * - 마우스 드래그로 가로 스크롤 (속도 1.5배)
 * - 스크롤 위치로 현재 인덱스 계산 (`clientWidth` 기준 반올림)
 * - 드래그 중에는 onScroll 이벤트에 의한 인덱스 업데이트를 무시
 */
export function useImageSliderDrag<T extends HTMLElement = HTMLDivElement>() {
  const scrollRef = useRef<T | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onScroll = useCallback(
    (e: React.UIEvent<T>) => {
      if (isDragging) return;
      const container = e.currentTarget;
      const index = Math.round(container.scrollLeft / container.clientWidth);
      setCurrentImageIndex((prev) => (prev !== index ? index : prev));
    },
    [isDragging]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    if (scrollRef.current) {
      const container = scrollRef.current;
      const index = Math.round(container.scrollLeft / container.clientWidth);
      setCurrentImageIndex(index);
    }
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollRef.current.scrollLeft = scrollLeft - walk;
    },
    [isDragging, startX, scrollLeft]
  );

  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setCurrentImageIndex(0);
  }, []);

  return {
    scrollRef,
    currentImageIndex,
    setCurrentImageIndex,
    isDragging,
    onScroll,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    resetScroll,
  };
}
