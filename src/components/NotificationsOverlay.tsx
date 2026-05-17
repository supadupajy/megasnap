"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
// ─────────────────────────────────────────────────────────────
const NotificationsOverlay: React.FC<NotificationsOverlayProps> = ({ open, onClose }) => {
  // 안드로이드 뒤로가기 처리: 오버레이가 열려 있으면 닫기로 가로챔
  useEffect(() => {
    if (!open) return;
    (window as any).__isNotificationsOverlayOpen = true;
    return () => {
      (window as any).__isNotificationsOverlayOpen = false;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="notifications-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[13000] bg-white"
        >
          <Notifications onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default NotificationsOverlay;
