"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Messages from '@/pages/Messages';

interface MessagesOverlayProps {
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// 메시지 페이지를 라우트 변경 없이 현재 페이지 위에 덮는 오버레이.
// - 라우트가 바뀌지 않으므로 아래 페이지(예: Flicks)의 영상/상태가 그대로 살아있음.
// - X 버튼 또는 BottomNav 탭 클릭 시 onClose 호출 → 오버레이만 사라지고
//   아래 페이지가 그대로 이어진다.
// ─────────────────────────────────────────────────────────────
const MessagesOverlay: React.FC<MessagesOverlayProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    // 알림/메시지 오버레이는 App.tsx에서 mutually exclusive하게 관리되므로
    // 동시에 두 개가 떠 있는 케이스는 없다 → 단순히 자기 자신만 flag 처리.
    (window as any).__isMessagesOverlayOpen = true;
    (window as any).__isAppOverlayOpen = true;
    window.dispatchEvent(new CustomEvent('app-overlay-visibility', { detail: { open: true } }));
    return () => {
      (window as any).__isMessagesOverlayOpen = false;
      (window as any).__isAppOverlayOpen = false;
      window.dispatchEvent(new CustomEvent('app-overlay-visibility', { detail: { open: false } }));
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="messages-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[12500] bg-white"
        >
          <Messages onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MessagesOverlay;
