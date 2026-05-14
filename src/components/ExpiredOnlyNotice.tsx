"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface ExpiredOnlyNoticeProps {
  /** 표시 여부 — 부모에서 "신규 마커 0개 + 지난 마커 > 0" 조건을 평가해 넘긴다. */
  visible: boolean;
  /** 화면 안에 남아있는 24h 지난 포스트 수 */
  count: number;
  /** 화면 하단에서부터의 거리 (px). 하단 인디케이터/주소 배지와 겹치지 않게. */
  bottomPx: number;
}

/**
 * "신규 마커는 없지만 24h 지난 추억이 있어요" 안내 토스트.
 * - sonner 토스트와 동일한 톤(흰 배경, 보더, 그림자)을 사용
 * - 조건이 유지되는 동안 계속 하단에 노출되며, 조건이 깨지면 fade out
 */
const ExpiredOnlyNotice: React.FC<ExpiredOnlyNoticeProps> = ({ visible, count, bottomPx }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="expired-only-notice"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed left-1/2 z-[26] pointer-events-none"
          style={{
            bottom: `${bottomPx}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* sonner 기본 톤: bg-background + border-border + shadow-lg */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-3.5 w-3.5 text-slate-600" strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground whitespace-nowrap">
              여긴 지금 비어있지만,{' '}
              <span className="text-slate-900 font-extrabold">
                시간이 지난 추억 {count > 99 ? '99+' : count}개
              </span>
              가 있어요
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExpiredOnlyNotice;
