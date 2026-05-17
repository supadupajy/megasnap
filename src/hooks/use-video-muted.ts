import { useEffect, useState } from 'react';

const STORAGE_KEY = 'reels_muted_session_v1';
const LEGACY_STORAGE_KEY = 'reels_muted_v1';
const EVENT_NAME = 'video-muted-change';

const readStored = (): boolean => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

/**
 * 앱 전역에서 영상 음소거 상태를 공유하는 hook.
 * - 기본값: 앱을 새로 열 때마다 음소거 ON
 * - sessionStorage(`reels_muted_session_v1`)에 현재 앱 세션 동안 저장
 * - 사용자가 음소거를 해제하면 앱을 닫기 전까지 다른 영상도 소리 켬 상태로 자동 재생
 * - 같은 페이지 내 다른 컴포넌트가 값을 바꾸면 커스텀 이벤트로 즉시 동기화됨
 */
export const useVideoMuted = (): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] => {
  const [muted, setMutedState] = useState<boolean>(readStored);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setMutedState(detail);
    };
    window.addEventListener(EVENT_NAME, handleCustom);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const setMuted = (next: boolean | ((prev: boolean) => boolean)) => {
    setMutedState((prev) => {
      const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(value));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: value }));
      } catch {}
      return value;
    });
  };

  return [muted, setMuted];
};
