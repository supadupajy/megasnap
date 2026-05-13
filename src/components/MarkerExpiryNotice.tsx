import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

const STORAGE_KEY = 'marker_expiry_notice_dismissed_v1';
const AUTO_HIDE_SECONDS = 10;

/**
 * 앱 시작 시 사용자에게 "마커는 24시간 후 자동 삭제됩니다" 안내 문구를 표시.
 * - 우측에 10초 카운트다운
 * - 우측 끝에 "다시 보지 않기" 버튼 (localStorage에 저장)
 * - 10초 후 자동으로 사라짐
 *
 * 실시간 인기 포스팅 패널 하단에 배치되며, 좌/우 마커 인디케이터를 가리지 않도록
 * 가운데 좁은 폭으로만 표시됨.
 */
const MarkerExpiryNotice: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [secondsLeft, setSecondsLeft] = useState<number>(AUTO_HIDE_SECONDS);
  const [isClosing, setIsClosing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // 카운트다운 시작
  useEffect(() => {
    if (!visible) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // fade-out 후 unmount
          setIsClosing(true);
          window.setTimeout(() => setVisible(false), 280);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]);

  const handleDismissForever = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setIsClosing(true);
    window.setTimeout(() => setVisible(false), 200);
  };

  if (!visible) return null;

  return (
    <div
      className={[
        'pointer-events-auto mt-2 mx-auto',
        'transition-all duration-300 ease-out',
        isClosing ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0',
      ].join(' ')}
      style={{ maxWidth: '100%' }}
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          'flex items-center gap-2',
          'rounded-2xl border',
          'bg-[#FBF1D9] border-[#E9C97A]',
          'shadow-[0_2px_8px_rgba(180,140,40,0.12)]',
          'pl-3 pr-2 py-2',
        ].join(' ')}
      >
        {/* 시계 아이콘 */}
        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center">
          <Clock className="w-[18px] h-[18px] text-[#8B6B1E]" strokeWidth={2.2} />
        </div>

        {/* 안내 문구 */}
        <p className="flex-1 min-w-0 text-[12.5px] font-semibold text-[#6B4F12] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
          마커는 24시간 후 자동 삭제됩니다
        </p>

        {/* 카운트다운 숫자 */}
        <span
          className="flex-shrink-0 text-[12px] font-black text-[#A07A1A] tabular-nums leading-none w-4 text-center"
          aria-label={`${secondsLeft}초 후 자동 닫힘`}
        >
          {secondsLeft}
        </span>

        {/* 다시 보지 않기 버튼 */}
        <button
          type="button"
          onClick={handleDismissForever}
          className={[
            'flex-shrink-0 text-[11px] font-bold',
            'text-[#6B4F12]/80 hover:text-[#6B4F12]',
            'bg-white/60 hover:bg-white/90 active:bg-white',
            'border border-[#E9C97A]/70',
            'rounded-full px-2.5 py-1',
            'transition-colors duration-150',
            'whitespace-nowrap',
          ].join(' ')}
        >
          다시 보지 않기
        </button>
      </div>
    </div>
  );
};

export default MarkerExpiryNotice;
