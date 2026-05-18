import React from 'react';

interface BubbleChatIconProps {
  className?: string;
  /**
   * 메인 말풍선과 아래 방울들의 색.
   * stroke로 사용되며, currentColor를 기본으로 사용합니다.
   */
  color?: string;
}

/**
 * "버블" 컨셉에 어울리는 동그란 말풍선 아이콘.
 * - 큰 동그란 말풍선 본체
 * - 아래쪽으로 떨어지는 작은 방울 2개 (비눗방울처럼 보이도록)
 *
 * lucide-react 스타일 (stroke 기반, 24x24 viewBox)로 그려서
 * 다른 헤더 아이콘들과 두께/톤이 자연스럽게 어울립니다.
 */
const BubbleChatIcon: React.FC<BubbleChatIconProps> = ({
  className,
  color = 'currentColor',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 메인 동그란 말풍선 */}
      <circle cx="13" cy="10" r="7" />

      {/* 말풍선 안쪽 하이라이트 (비눗방울 느낌) - stroke만 살짝 */}
      <path
        d="M9.5 7.5c.6-.9 1.6-1.5 2.7-1.7"
        strokeWidth={1.5}
        opacity={0.6}
      />

      {/* 아래로 떨어지는 작은 방울 2개 */}
      <circle cx="7" cy="18" r="2" />
      <circle cx="3.5" cy="21" r="1" />
    </svg>
  );
};

export default BubbleChatIcon;
