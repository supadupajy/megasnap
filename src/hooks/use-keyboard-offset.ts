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

      // editable이 아니면(키보드 없음 확정) 현재 시점의 가장 큰 높이를 baseline으로 재설정.
      // 이렇게 안 하면 한 번 키보드가 떠서 baseline이 커진 뒤, 안드로이드 WebView가
      // window.innerHeight 자체를 줄여서 baseline이 회복 안 되는 경우 BottomNav가
      // 영영 사라지는 버그가 생긴다.
      if (!activeElementIsEditable) {
        globalViewportBaseHeight = Math.max(window.innerHeight, viewportHeight);
      } else if (viewportHeight > globalViewportBaseHeight) {
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

    // 키보드 상태는 두 가지 시점에만 갱신한다.
    //  1) 키보드 올라옴: editable 요소가 포커스 + visualViewport가 충분히 줄어든 상태
    //     → 그 시점의 키보드 높이를 한 번만 커밋. 이후 부드럽게 줄어드는 중간값은 무시.
    //  2) 키보드 내려감: visualViewport.height가 layout viewport에 거의 도달한 시점
    //     → 0으로 한 번에 떨어뜨림.
    //
    // blur만 발생하고 키보드 OS 애니메이션은 진행 중인 상황에서 0으로 즉시 떨어뜨리지 않는다.
    // 이 시점에 sheet/BottomNav가 점프하면 키보드 내림 애니메이션과 어긋나서 깜빡임이 생긴다.
    const updateKeyboardState = () => {
      const { activeElementIsEditable, rawOffset } = computeRawOffset();
      const viewportIsShrunken = rawOffset > KEYBOARD_OFFSET_THRESHOLD;

      if (keyboardOffsetRef.current === 0) {
        if (activeElementIsEditable && viewportIsShrunken) {
          commitKeyboardOffset(rawOffset);
        }
        return;
      }

      if (!viewportIsShrunken) {
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
