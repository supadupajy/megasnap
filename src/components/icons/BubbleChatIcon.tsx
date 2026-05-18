import React from 'react';

interface BubbleChatIconProps {
  className?: string;
  color?: string;
}

/**
 * "버블" 컨셉의 동그란 말풍선 아이콘.
 * - 원형(circle) 본체에 좌측 하단으로 뾰족한 꼬리(tail)를 가진 말풍선.
 * - lucide-react 스타일(stroke 기반, 24x24 viewBox, 둥근 라인캡)에 맞춤.
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
      {/*
        동그란 말풍선 + 좌측 하단 뾰족한 꼬리.
        - 본체는 (12,11)을 중심으로 한 반지름 8의 원에 가깝게 그리되,
          좌측 하단 부분만 살짝 끊고 뾰족한 꼬리로 이어지게 함.
      */}
      <path d="M20 11a8 8 0 1 1-13.657 5.657L3 20l2.343-3.343A8 8 0 0 1 20 11Z" />
    </svg>
  );
};

export default BubbleChatIcon;
