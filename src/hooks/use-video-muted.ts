import { useEffect, useState } from 'react';

const STORAGE_KEY = 'reels_muted_v1';
const EVENT_NAME = 'video-muted-change';

const readStored = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

/**
 * 앱 전역에서 영상 음소거 상태를 공유하는 hook.
 * - 기본값: 음소거 ON
 * - localStorage(`reels_muted_v1`)에 영구 저장
 * - 같은 페이지 내 다른 컴포넌트가 값을 바꾸면 커스텀 이벤트로 즉시 동기화됨
 *   (다른 탭에서 변경된 경우엔 `storage` 이벤트로 동기화)
 */
export const useVideoMuted = (): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] => {
  const [muted, setMutedState] = useState<boolean>(readStored);

  useEffect(() => {
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setMutedState(detail);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setMutedState(readStored());
    };
    window.addEventListener(EVENT_NAME, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setMuted = (next: boolean | ((prev: boolean) => boolean)) => {
    setMutedState((prev) => {
      const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      try {
        localStorage.setItem(STORAGE_KEY, String(value));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: value }));
      } catch {}
      return value;
    });
  };

  return [muted, setMuted];
};
