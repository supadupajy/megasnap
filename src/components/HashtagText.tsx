import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { normalizeHashtag } from '@/utils/hashtags';

// hashtags.ts의 HASHTAG_BODY와 동일한 패턴 (재사용을 위해 직접 선언)
const HASHTAG_SPLIT_REGEX = /(#[\p{L}\p{N}_가-힣ㄱ-ㅎㅏ-ㅣ]{1,40})/gu;
const HASHTAG_TEST_REGEX = /^#[\p{L}\p{N}_가-힣ㄱ-ㅎㅏ-ㅣ]{1,40}$/u;

interface HashtagTextProps {
  /** 렌더링할 본문 텍스트 */
  text: string;
  /** 태그 컬러 등 커스텀 클래스 (기본: 인디고) */
  tagClassName?: string;
  /** 태그 클릭 시 호출 (기본: 포스팅 검색 페이지로 이동하며 자동 검색) */
  onTagClick?: (tag: string) => void;
  /** 외부 컨테이너 onClick 전파 차단 여부 (기본 true) */
  stopPropagationOnTagClick?: boolean;
}

/**
 * 본문 텍스트 내부의 #해시태그를 인디고 컬러의 클릭 가능한 링크로 렌더링한다.
 * 클릭 시 포스팅 검색 페이지로 이동하면서 해당 태그를 자동으로 검색한다.
 */
const HashtagText: React.FC<HashtagTextProps> = ({
  text,
  tagClassName,
  onTagClick,
  stopPropagationOnTagClick = true,
}) => {
  const navigate = useNavigate();
  const parts = useMemo(() => {
    if (!text) return [] as string[];
    return text.split(HASHTAG_SPLIT_REGEX);
  }, [text]);

  const handleTagClick = (rawTag: string) => (e: React.MouseEvent) => {
    if (stopPropagationOnTagClick) e.stopPropagation();
    e.preventDefault();

    const normalized = normalizeHashtag(rawTag);
    if (!normalized) return;

    const query = `#${normalized}`;

    if (onTagClick) {
      onTagClick(normalized);
      return;
    }

    // 검색 페이지가 mount 전이라도 sessionStorage에 미리 적재해 즉시 검색되도록.
    try {
      sessionStorage.setItem('postSearch_query', query);
      sessionStorage.removeItem('postSearch_results');

      // 지도마커 상세에서 태그 검색으로 이동한 뒤 뒤로가면 상세를 유지해야 한다.
      if ((window as any).__isPostDetailOpen === true) {
        sessionStorage.setItem('postSearch_returnToPostDetail', '1');
        history.replaceState({ ...(history.state || {}), postDetailOpen: true }, '');
      }

      console.log('[TagSearchDebug][HashtagClick]', {
        query,
        postDetailOpen: (window as any).__isPostDetailOpen,
        historyState: history.state,
        returnToPostDetail: sessionStorage.getItem('postSearch_returnToPostDetail'),
      });
    } catch {}

    // 포스팅 검색 페이지로 이동 (URL 쿼리에 검색어 전달).
    navigate(`/post-search?q=${encodeURIComponent(query)}`);
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
