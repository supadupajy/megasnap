"use client";

import { useState, useEffect } from "react";

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // 실제 브라우저/OS의 키보드에 의한 뷰포트 변화 감지
    if (window.visualViewport) {
      const handleResize = () => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        // 전체 윈도우 높이와 현재 가시 뷰포트 높이의 차이를 키보드 높이로 간주
        const heightDiff = window.innerHeight - viewport.height;
        
        // 보통 150px 이상 차이가 나면 키보드가 올라온 것으로 판단
        if (heightDiff > 150) {
          setKeyboardHeight(heightDiff);
          setIsKeyboardOpen(true);
        } else {
          setKeyboardHeight(0);
          setIsKeyboardOpen(false);
        }
      };

      window.visualViewport.addEventListener("resize", handleResize);
      // 초기 상태 체크
      handleResize();
      
      return () => window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}

// 가상 키보드 트리거 함수는 더 이상 필요 없으므로 빈 함수로 대체하거나 제거
export const triggerVirtualKeyboard = (isOpen: boolean) => {
  // No-op: 실제 키보드는 input focus 시 자동으로 올라옵니다.
};