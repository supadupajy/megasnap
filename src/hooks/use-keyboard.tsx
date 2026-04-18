"use client";

import { useState, useEffect } from "react";

// 가상 키보드 상태를 위한 전역 이벤트 시스템
const KBD_EVENT = 'chora_virtual_keyboard';

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // 1. 실제 모바일 브라우저의 VisualViewport 감지
    if (window.visualViewport) {
      const handleResize = () => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        const heightDiff = window.innerHeight - viewport.height;
        // 150px 이상 차이나면 키보드가 올라온 것으로 간주
        if (heightDiff > 150) {
          setKeyboardHeight(heightDiff);
          setIsKeyboardOpen(true);
        } else {
          // 가상 키보드 이벤트가 없을 때만 초기화
          if (!document.body.classList.contains('virtual-keyboard-active')) {
            setKeyboardHeight(0);
            setIsKeyboardOpen(false);
          }
        }
      };

      window.visualViewport.addEventListener("resize", handleResize);
      return () => window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    // 2. 웹 프리뷰용 가상 키보드 이벤트 감지
    const handleVirtualKbd = (e: any) => {
      const { isOpen, height } = e.detail;
      setKeyboardHeight(height);
      setIsKeyboardOpen(isOpen);
      if (isOpen) {
        document.body.classList.add('virtual-keyboard-active');
      } else {
        document.body.classList.remove('virtual-keyboard-active');
      }
    };

    window.addEventListener(KBD_EVENT, handleVirtualKbd);
    return () => window.removeEventListener(KBD_EVENT, handleVirtualKbd);
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}

// 입력창 포커스 시 이벤트를 발생시키는 헬퍼
export const triggerVirtualKeyboard = (isOpen: boolean) => {
  const event = new CustomEvent(KBD_EVENT, { 
    detail: { isOpen, height: isOpen ? 300 : 0 } 
  });
  window.dispatchEvent(event);
};