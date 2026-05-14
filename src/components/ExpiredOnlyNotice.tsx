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
 * - 진한 슬레이트 톤 알약형 (롱프레스 토스트와 동일 패밀리)
 * - 조건이 유지되는 동안 계속 하단 중앙에 노출되며, 조건이 깨지면 fade out
 *
 * 가운데 정렬은 외부 wrapper의 left:50% / translateX(-50%)로 처리하고,
 * motion의 transform(y/scale)은 내부 div에만 적용해 충돌을 막는다.
 */
const ExpiredOnlyNotice: React.FC<ExpiredOnlyNoticeProps> = ({ visible, count, bottomPx }) => {
  return (
    <div
      className="fixed left-1/2 z-[26] pointer-events-none"
      style={{
        bottom: `${bottomPx}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="expired-only-notice"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock className="h-3.5 w-3.5 text-amber-300 shrink-0" strokeWidth={2.6} />
            <span className="text-[12px] font-bold tracking-[-0.01em] text-white/90">
              여긴 지금 비어있지만,{' '}
              <span className="text-amber-300 font-black">
                시간이 지난 추억 {count > 99 ? '99+' : count}개
              </span>
              가 있어요
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpiredOnlyNotice;
