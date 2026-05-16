import { useEffect, useRef, useState } from 'react';

const KEYBOARD_THRESHOLD = 120;
const SAFE_TOP_MARGIN = 104;
const SAFE_BOTTOM_MARGIN = 96;
const CHECK_DELAYS = [60, 160, 320, 520];

let viewportBaseHeight = 0;

const getKeyboardOffset = () => {
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportTop = viewport?.offsetTop ?? 0;

  viewportBaseHeight = Math.max(viewportBaseHeight, window.innerHeight, viewportHeight);

  const layoutViewportDiff = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
  const baseViewportDiff = Math.max(0, viewportBaseHeight - viewportHeight - viewportTop);
  const offset = Math.max(layoutViewportDiff, baseViewportDiff);

  return offset > KEYBOARD_THRESHOLD ? offset : 0;
};

const getScrollableParent = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);

    if (canScroll && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
};

export const useKeyboardSafeScroll = <T extends HTMLElement>(active: boolean) => {
  const targetRef = useRef<T>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!active) {
      setKeyboardOffset(0);
      return;
    }

    let timers: number[] = [];

    const scrollTargetIntoSafeArea = () => {
      const target = targetRef.current;
      if (!target) return;

      const viewport = window.visualViewport;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
      const keyboardHeight = getKeyboardOffset();

      setKeyboardOffset(keyboardHeight);

      // 수정 모드 진입만으로는 스크롤하지 않는다.
      // 실제 키보드가 올라온 뒤에만 내부 스크롤 컨테이너를 보정한다.
      if (keyboardHeight === 0) return;

      const rect = target.getBoundingClientRect();
      const bottomLimit = visibleBottom - SAFE_BOTTOM_MARGIN;
      const topLimit = visibleTop + SAFE_TOP_MARGIN;
      const bottomOverflow = rect.bottom - bottomLimit;
      const topOverflow = rect.top - topLimit;
      const delta = bottomOverflow > 0 ? bottomOverflow : topOverflow < 0 ? topOverflow : 0;

      if (Math.abs(delta) < 1) return;

      const scrollableParent = getScrollableParent(target);
      if (scrollableParent) {
        scrollableParent.scrollTo({ top: scrollableParent.scrollTop + delta, behavior: 'smooth' });
      }
      // 중요: scrollable parent가 없을 때 window/body를 스크롤하지 않는다.
      // 지도 화면은 항상 메모리에 살아있으므로 window.scrollBy가 발생하면
      // 키보드 보정 과정에서 지도 레이어까지 같이 밀려 보일 수 있다.
    };

    const scheduleChecks = () => {
      timers.forEach(window.clearTimeout);
      timers = CHECK_DELAYS.map((delay) => window.setTimeout(scrollTargetIntoSafeArea, delay));
    };

    scheduleChecks();
    window.visualViewport?.addEventListener('resize', scheduleChecks);
    window.visualViewport?.addEventListener('scroll', scheduleChecks);
    window.addEventListener('resize', scheduleChecks);
    window.addEventListener('focusin', scheduleChecks);

    return () => {
      timers.forEach(window.clearTimeout);
      window.visualViewport?.removeEventListener('resize', scheduleChecks);
      window.visualViewport?.removeEventListener('scroll', scheduleChecks);
      window.removeEventListener('resize', scheduleChecks);
      window.removeEventListener('focusin', scheduleChecks);
    };
  }, [active]);

  return { targetRef, keyboardOffset };
};
