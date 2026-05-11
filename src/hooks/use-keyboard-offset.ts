import { useEffect, useRef, useState } from 'react';

let globalViewportBaseHeight = 0;

const KEYBOARD_OFFSET_THRESHOLD = 120;

const isEditableElement = (element: Element | null) => {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
};

export const useKeyboardOffset = (active = true) => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const keyboardOffsetRef = useRef(0);

  useEffect(() => {
    const commitKeyboardOffset = (nextOffset: number) => {
      if (keyboardOffsetRef.current === nextOffset) return;
      keyboardOffsetRef.current = nextOffset;
      setKeyboardOffset(nextOffset);
    };

    if (!active) {
      commitKeyboardOffset(0);
      return;
    }

    const computeRawOffset = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const activeElementIsEditable = isEditableElement(document.activeElement);

      if (!activeElementIsEditable || viewportHeight > globalViewportBaseHeight) {
        globalViewportBaseHeight = Math.max(globalViewportBaseHeight, window.innerHeight, viewportHeight);
      }

      const layoutViewportDiff = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
      const baseViewportDiff = Math.max(0, globalViewportBaseHeight - viewportHeight - viewportTop);
      const offset = Math.max(layoutViewportDiff, baseViewportDiff);

      return {
        activeElementIsEditable,
        rawOffset: offset,
      };
    };

    // 키보드가 열려 있는지 여부만 boolean으로 추적한다.
    // 슬라이딩 현상을 막기 위해 중간값(점진적으로 감소하는 offset)은 흘려보내지 않는다.
    // - 키보드가 열렸다고 판단되면 즉시 "열린 시점의 키보드 높이"를 한 번만 커밋
    // - 키보드가 닫혔다고 판단되면 즉시 0으로 한 번에 떨어뜨림
    const updateKeyboardState = () => {
      const { activeElementIsEditable, rawOffset } = computeRawOffset();
      const keyboardIsOpen = activeElementIsEditable && rawOffset > KEYBOARD_OFFSET_THRESHOLD;

      if (keyboardIsOpen) {
        if (keyboardOffsetRef.current === 0) {
          commitKeyboardOffset(rawOffset);
        }
        return;
      }

      if (keyboardOffsetRef.current !== 0) {
        commitKeyboardOffset(0);
      }
    };

    const scheduleUpdates = () => {
      updateKeyboardState();
      window.setTimeout(updateKeyboardState, 80);
      window.setTimeout(updateKeyboardState, 220);
      window.setTimeout(updateKeyboardState, 420);
    };

    scheduleUpdates();
    window.visualViewport?.addEventListener('resize', updateKeyboardState);
    window.visualViewport?.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    window.addEventListener('orientationchange', scheduleUpdates);
    window.addEventListener('focusin', scheduleUpdates);
    window.addEventListener('focusout', scheduleUpdates);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardState);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('orientationchange', scheduleUpdates);
      window.removeEventListener('focusin', scheduleUpdates);
      window.removeEventListener('focusout', scheduleUpdates);
    };
  }, [active]);

  return keyboardOffset;
};
