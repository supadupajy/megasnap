"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * 댓글 다이얼로그/알림/메시지 등 \"앱 위에 떠 있는 오버레이\" 가시성 상태.
 *
 * 배경:
 *  - PostItem / ReelsViewer 슬라이드 / VideoPlayer 등은 오버레이가 떠 있는 동안
 *    영상을 잠시 멈추기 위해 `comments-dialog-visibility`, `app-overlay-visibility`
 *    window 이벤트를 각자 addEventListener로 listen하고 있었다.
 *  - 피드에 PostItem이 100개 있으면 같은 글로벌 이벤트에 200개의 리스너가 붙어
 *    각 이벤트 디스패치마다 200번의 콜백 실행 + 200번의 setState로 이어졌다.
 *
 * 이 Provider는 그 두 이벤트를 \"앱 전체에서 단 1번\"만 listen하여 React Context로
 * 공유한다. 외부에서 이벤트를 발행하는 코드(PostCommentsDialog, NotificationsOverlay,
 * MessagesOverlay 등)는 일절 변경하지 않아도 되므로 하위 호환이 보장된다.
 *
 * 사용:
 *   const { isAnyOverlayOpen, isCommentsDialogOpen, isAppOverlayOpen } = useOverlayVisibility();
 */

interface OverlayVisibilityContextValue {
  /** 댓글 다이얼로그가 열려 있는지 (PostCommentsDialog) */
  isCommentsDialogOpen: boolean;
  /** 알림/메시지 등 전역 오버레이가 열려 있는지 */
  isAppOverlayOpen: boolean;
  /** 둘 중 하나라도 열려 있으면 true (영상 일시정지 신호로 가장 자주 쓰이는 값) */
  isAnyOverlayOpen: boolean;
}

const DEFAULT_VALUE: OverlayVisibilityContextValue = {
  isCommentsDialogOpen: false,
  isAppOverlayOpen: false,
  isAnyOverlayOpen: false,
};

const OverlayVisibilityContext =
  createContext<OverlayVisibilityContextValue>(DEFAULT_VALUE);

export const OverlayVisibilityProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      return !!(window as any).__commentsDialogOpen;
    }
  );
  const [isAppOverlayOpen, setIsAppOverlayOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(window as any).__isAppOverlayOpen;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleComments = (e: Event) => {
      const next = !!(e as CustomEvent).detail?.open;
      setIsCommentsDialogOpen((prev) => (prev === next ? prev : next));
    };
    const handleAppOverlay = (e: Event) => {
      const next = !!(e as CustomEvent).detail?.open;
      setIsAppOverlayOpen((prev) => (prev === next ? prev : next));
    };

    // 초기 sync: window 플래그가 이미 true로 설정돼 있을 수도 있으므로 한 번 더 맞춤
    setIsCommentsDialogOpen(!!(window as any).__commentsDialogOpen);
    setIsAppOverlayOpen(!!(window as any).__isAppOverlayOpen);

    window.addEventListener("comments-dialog-visibility", handleComments);
    window.addEventListener("app-overlay-visibility", handleAppOverlay);
    return () => {
      window.removeEventListener("comments-dialog-visibility", handleComments);
      window.removeEventListener("app-overlay-visibility", handleAppOverlay);
    };
  }, []);

  const value: OverlayVisibilityContextValue = {
    isCommentsDialogOpen,
    isAppOverlayOpen,
    isAnyOverlayOpen: isCommentsDialogOpen || isAppOverlayOpen,
  };

  return (
    <OverlayVisibilityContext.Provider value={value}>
      {children}
    </OverlayVisibilityContext.Provider>
  );
};

export const useOverlayVisibility = (): OverlayVisibilityContextValue => {
  return useContext(OverlayVisibilityContext);
};
