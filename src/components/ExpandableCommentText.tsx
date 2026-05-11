import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ExpandableCommentTextProps {
  text: string;
  expanded: boolean;
  onExpand: () => void;
  className?: string;
}

const ExpandableCommentText = ({ text, expanded, onExpand, className }: ExpandableCommentTextProps) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) {
      setIsClamped(false);
      return;
    }

    const checkClamp = () => {
      setIsClamped(element.scrollHeight > element.clientHeight + 1);
    };

    checkClamp();

    const resizeObserver = new ResizeObserver(checkClamp);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [text, expanded]);

  return (
    <div className="relative min-w-0 flex-1">
      <span
        ref={textRef}
        className={cn(
          'block break-words whitespace-pre-wrap leading-snug',
          expanded ? '' : 'line-clamp-2',
          !expanded && isClamped ? 'pr-14' : '',
          className
        )}
      >
        {text}
      </span>
      {!expanded && isClamped && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="absolute bottom-0 right-0 bg-white pl-1 text-xs font-black text-indigo-600 transition-colors hover:text-indigo-800"
        >
          더 보기
        </button>
      )}
    </div>
  );
};

export default ExpandableCommentText;
