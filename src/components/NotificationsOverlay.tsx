"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Notifications from '@/pages/Notifications';

interface NotificationsOverlayProps {
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// 알림 페이지를 라우트 변경 없이 현재 페이지 위에 덮는 오버레이.
// - 라우트가 바뀌지 않으므로 아래 페이지(예: Flicks)의 영상/상태가 그대로 살아있음.
// - X 버튼 또는 BottomNav 탭 클릭 시 onClose 호출 → 오버레이만 사라지고
//   아래 페이지가 그대로 이어진다.
// - z-index는 Header(12600)보다 낮은 12500으로 둬서 글로벌 헤더(ToCaToCa 로고 +
//   종/메시지 버튼)는 그대로 보이게 한다. 알림 페이지 자체의 sticky 헤더는
//   pt-16(글로벌 헤더 높이만큼)으로 헤더 아래에 위치한다.
// - 영상 pause 시그널: open되면 app-overlay-visibility 이벤트와 __isAppOverlayOpen
//   플래그를 set하여, ReelsViewer/PostItem 등 비디오 컴포넌트들이 일시정지하도록 한다.
// ─────────────────────────────────────────────────────────────
const NotificationsOverlay: React.FC<NotificationsOverlayProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    // 알림/메시지 오버레이는 App.tsx에서 mutually exclusive하게 관리되므로
    // 동시에 두 개가 떠 있는 케이스는 없다 → 단순히 자기 자신만 flag 처리.
    (window as any).__isNotificationsOverlayOpen = true;
    (window as any).__isAppOverlayOpen = true;
    window.dispatchEvent(new CustomEvent('app-overlay-visibility', { detail: { open: true } }));
    return () => {
      (window as any).__isNotificationsOverlayOpen = false;
      (window as any).__isAppOverlayOpen = false;
      window.dispatchEvent(new CustomEvent('app-overlay-visibility', { detail: { open: false } }));
    };
  }, [open]);

  if (typeof document === 'undefined') return null;
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12500] bg-white">
      <Notifications onClose={onClose} />
    </div>,
    document.body
  );
};

export default NotificationsOverlay;
