"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CollapsingHeaderProps {
  /** 0(펼침) ~ 1(축소) 사이의 진행도 */
  progress: number;
  /** 헤더 좌측 아이콘 */
  Icon: LucideIcon;
  /** 아이콘 배경 색상 (Tailwind class) */
  iconBgClass: string;
  /** 아이콘 색상 (Tailwind class) */
  iconColorClass: string;
  /** 아이콘에 fill 처리할지 여부 */
  iconFilled?: boolean;
  /** 메인 타이틀 텍스트 */
  title: string;
  /** 서브 타이틀 (TRENDING NOW 같은 작은 텍스트) */
  subtitle: string;
  /** 우측 버튼 아이콘 (없으면 버튼 미표시) */
  ActionIcon?: LucideIcon;
  actionLabel?: string;
  onActionClick?: () => void;
  /** 축소 시 우측 버튼을 숨기지 않고 아이콘 버튼으로 유지 */
  collapseActionToIcon?: boolean;
  /** 축소 시 우측에 표시되는 힌트 텍스트 (액션 버튼과 페이드 교차) */
  collapsedHint?: string;
}

/**
 * 스크롤에 따라 부드럽게 축소되는 collapsing header
 * - 헤더 패딩/높이 축소
 * - 아이콘 박스 크기 축소
 * - 타이틀 폰트 크기 축소
 * - 서브타이틀 fade-out
 * - 우측 버튼 fade-out + slide-out
 */
const CollapsingHeader: React.FC<CollapsingHeaderProps> = ({
  progress,
  Icon,
  iconBgClass,
  iconColorClass,
  iconFilled = false,
  title,
  subtitle,
  ActionIcon,
  actionLabel,
  onActionClick,
  collapseActionToIcon = false,
  collapsedHint,
}) => {
  // 보간 함수 (lerp)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // 패딩: py-4(16px) -> py-2(8px)
  const padY = lerp(16, 8, progress);
  // 아이콘 박스: 40px -> 28px
  const iconBox = lerp(40, 28, progress);
  // 아이콘 자체: 24px -> 16px
  const iconSize = lerp(24, 16, progress);
  // 타이틀 폰트: 18px(text-lg) -> 15px
  const titleSize = lerp(18, 15, progress);
  // gap: 12px -> 8px
  const gap = lerp(12, 8, progress);
  // 서브타이틀 opacity (0.6에서 이미 거의 사라지도록 가속)
  const subtitleOpacity = Math.max(0, 1 - progress * 1.8);
  const subtitleHeight = lerp(14, 0, Math.min(1, progress * 1.2));
  // 액션 버튼 opacity + translateX
  const actionOpacity = collapseActionToIcon ? 1 : Math.max(0, 1 - progress * 1.6);
  const actionTranslate = collapseActionToIcon ? 0 : progress * 24;
  // 액션 버튼 보더 라디우스 (둥근 알약 형태 유지)
  const actionPadX = collapseActionToIcon ? lerp(16, 10, progress) : lerp(16, 12, progress);
  const actionPadY = collapseActionToIcon ? lerp(8, 8, progress) : lerp(8, 6, progress);
  const actionGap = actionLabel
    ? (collapseActionToIcon ? lerp(6, 0, progress) : 6)
    : 0;
  const actionLabelProgress = Math.min(1, progress * 1.5);
  const actionLabelOpacity = collapseActionToIcon ? Math.max(0, 1 - progress * 1.8) : 1;
  // 펼친 상태에서는 라벨 전체가 보이도록 넉넉하게(80px) 잡고, 축소 시 0으로 줄어든다.
  const actionLabelMaxWidth = collapseActionToIcon ? lerp(80, 0, actionLabelProgress) : undefined;

  return (
    <div
      className="w-full max-w-full overflow-hidden px-4 bg-gray-50 border-b border-gray-100 transition-colors"
      style={{ paddingTop: padY, paddingBottom: padY }}
    >
      <div className="flex min-w-0 items-center justify-between">
        <div className="flex min-w-0 items-center" style={{ gap: `${gap}px` }}>
          <div
            className={`${iconBgClass} rounded-2xl flex items-center justify-center shadow-sm shrink-0`}
            style={{ width: iconBox, height: iconBox }}
          >
            <Icon
              className={iconColorClass}
              style={{
                width: iconSize,
                height: iconSize,
                fill: iconFilled ? 'currentColor' : 'none',
              }}
            />
          </div>
          <div className="min-w-0">
            <h2
              className="font-black text-gray-900 tracking-tight leading-tight"
              style={{ fontSize: `${titleSize}px` }}
            >
              {title}
            </h2>
            <p
              className="text-[10px] text-gray-400 font-medium uppercase tracking-widest overflow-hidden whitespace-nowrap"
              style={{
                opacity: subtitleOpacity,
                height: `${subtitleHeight}px`,
                lineHeight: '14px',
                marginTop: subtitleHeight > 0 ? '1px' : '0px',
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        {ActionIcon && onActionClick && (
        <div className="relative flex items-center shrink-0">
          {collapsedHint && (
            <div
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 flex items-center"
              style={{
                opacity: Math.max(0, (progress - 0.4) * 1.8),
                transform: `translate(${(1 - Math.min(1, progress * 1.4)) * 12}px, -50%)`,
              }}
            >
              <span className="text-[11px] font-semibold text-orange-600 whitespace-nowrap bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1">
                {collapsedHint}
              </span>
            </div>
          )}

          <button
            onClick={onActionClick}
            className="flex items-center bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-transform shrink-0 overflow-hidden"
            style={{
              gap: `${actionGap}px`,
              opacity: actionOpacity,
              transform: `translateX(${actionTranslate}px)`,
              pointerEvents: actionOpacity < 0.1 ? 'none' : 'auto',
              paddingLeft: actionPadX,
              paddingRight: actionPadX,
              paddingTop: actionPadY,
              paddingBottom: actionPadY,
            }}
          >
            <ActionIcon className="w-4 h-4 text-gray-900 shrink-0" />
            {actionLabel && (
              <span
                className="text-sm font-normal text-gray-900 whitespace-nowrap overflow-hidden"
                style={{
                  opacity: actionLabelOpacity,
                  maxWidth: actionLabelMaxWidth,
                }}
              >
                {actionLabel}
              </span>
            )}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default CollapsingHeader;