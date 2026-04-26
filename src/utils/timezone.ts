/**
 * 타임존 정보를 관리하는 유틸리티입니다.
 * DB 부하를 줄이기 위해 브라우저 내장 Intl API를 사용하며,
 * 한 번 로드된 데이터는 메모리에 캐싱됩니다.
 */

let timezoneCache: string[] | null = null;

export const getTimezones = (): string[] => {
  // 이미 캐싱된 데이터가 있으면 반환
  if (timezoneCache) {
    return timezoneCache;
  }

  try {
    // 브라우저의 Intl API를 사용하여 지원되는 전체 타임존 목록을 가져옵니다.
    // (대부분의 현대 브라우저에서 지원하는 표준 방식입니다)
    timezoneCache = (Intl as any).supportedValuesOf('timeZone');
    console.log('[Timezone] 타임존 목록이 메모리에 캐싱되었습니다.');
  } catch (error) {
    console.error('[Timezone] 타임존 목록을 로드하는 중 오류 발생:', error);
    // 폴백(Fallback)으로 기본 타임존만 반환
    return ['UTC', 'Asia/Seoul'];
  }

  return timezoneCache || [];
};

/**
 * 현재 사용자의 시스템 타임존을 반환합니다.
 */
export const getCurrentTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
