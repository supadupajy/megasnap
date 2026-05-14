"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface ExpiredOnlyNoticeProps {
  /** 표시 여부 — 부모에서 "신규 마커 0개 + 지난 마커 > 0" 조건을 평가해 넘긴다. */
  visible: boolean;
  /** 화면 안에 남아있는 24h 지난 포스트 수 */
  count: number;
  /** 트렌딩 패널 아래쪽에 배치되도록 부모에서 top 좌표를 전달 */
  topPx: number;
}

/**
 * "신규 마커는 없지만 24h 지난 추억이 있어요" 안내 토스트.
 * 조건이 유지되는 동안 계속 노출되며, 조건이 깨지면 fade out.
 */
const ExpiredOnlyNotice: React.FC<ExpiredOnlyNoticeProps> = ({ visible, count, topPx }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="expired-only-notice"
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed left-1/2 z-[26] pointer-events-none"
          style={{
            top: `${topPx}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3.5 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl"
          >
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-3 w-3 text-slate-600" strokeWidth={2.5} />
              <span className="absolute inset-0 rounded-full ring-2 ring-slate-300/40 animate-ping" />
            </span>
            <span className="text-[11px] font-black tracking-[-0.01em] text-slate-700">
              여긴 지금 비어있지만,{' '}
              <span className="text-slate-900">시간이 지난 추억 {count > 99 ? '99+' : count}개</span>
              가 있어요
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpiredOnlyNotice;
