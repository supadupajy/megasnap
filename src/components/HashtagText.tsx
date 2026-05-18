import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { normalizeHashtag } from '@/utils/hashtags';

const HASHTAG_SPLIT_REGEX = /(#[\p{L}\p{N}_가-힣ㄱ-ㅎㅏ-ㅣ]{1,40})/gu;
const HASHTAG_TEST_REGEX = /^#[\p{L}\p{N}_가-힣ㄱ-ㅎㅏ-ㅣ]{1,40}$/u;

interface HashtagTextProps {
  text: string;
  tagClassName?: string;
  onTagClick?: (tag: string) => void;
  stopPropagationOnTagClick?: boolean;
}

const HashtagText: React.FC<HashtagTextProps> = ({
  text,
  tagClassName,
  onTagClick,
  stopPropagationOnTagClick = true,
}) => {
  const parts = useMemo(() => {
    if (!text) return [] as string[];
    return text.split(HASHTAG_SPLIT_REGEX);
  }, [text]);

  const handleTagClick = (rawTag: string) => (e: React.MouseEvent) => {
    if (stopPropagationOnTagClick) e.stopPropagation();
    e.preventDefault();

    const normalized = normalizeHashtag(rawTag);
    if (!normalized) return;

    if (onTagClick) {
      onTagClick(normalized);
      return;
    }

    const query = `#${normalized}`;

    try {
      sessionStorage.setItem('postSearch_query', query);
      sessionStorage.removeItem('postSearch_results');
    } catch {}

    window.dispatchEvent(
      new CustomEvent('open-post-search-overlay', {
        detail: { query },
      })
    );
  };

  if (!text) return null;

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;

        if (HASHTAG_TEST_REGEX.test(part)) {
          return (
            <button
              key={`${idx}-${part}`}
              type="button"
              onClick={handleTagClick(part)}
              className={cn(
                'font-bold text-indigo-600 hover:text-indigo-700 hover:underline active:text-indigo-800 transition-colors',
                tagClassName,
              )}
            >
              {part}
            </button>
          );
        }

        return <React.Fragment key={`${idx}-text`}>{part}</React.Fragment>;
      })}
    </>
  );
};

export default HashtagText;