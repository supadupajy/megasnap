"use client";

import { useState, useEffect } from "react";

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // 실제 모바일 브라우저의 VisualViewport 감지
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
          setKeyboardHeight(0);
          setIsKeyboardOpen(false);
        }
      };

      window.visualViewport.addEventListener("resize", handleResize);
      return () => window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}

// 가상 키보드 트리거 함수는 인터페이스 유지를 위해 빈 함수로 남겨둠
export const triggerVirtualKeyboard = (_isOpen: boolean) => {
  // 가상 키보드 시뮬레이션 중단
};