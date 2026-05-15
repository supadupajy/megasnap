export const normalizeRegionName = (regionName: string) => {
  const aliases: Record<string, string> = {
    서울: '서울시',
    부산: '부산시',
    인천: '인천시',
    대구: '대구시',
    대전: '대전시',
    광주: '광주시',
    울산: '울산시',
    세종특별자치시: '세종시',
    강원특별자치도: '강원도',
  };

  return aliases[regionName] || regionName;
};

export const normalizeLocationName = (locationName: string) => {
  return locationName.split('강원특별자치도').join('강원도');
};

export const formatAdministrativeAddress = (
  city?: string,
  district?: string,
  dong?: string
) => {
  return [normalizeRegionName(city || ''), district || '', dong || '']
    .filter(Boolean)
    .join(' ');
};

// ─────────────────────────────────────────────────────────────────────────────
// 좌표 → 행정 주소 문자열의 프로세스 전역 메모리 캐시.
//
// 카카오 Geocoder.coord2Address 호출량을 줄이기 위해, 한 번 해석된 (lat,lng)는
// 세션이 끝날 때까지 다시 호출하지 않는다.
// - 키는 소수점 5자리(약 1m)로 양자화한 "lat,lng" 문자열.
// - 같은 행정동 안에서의 미세한 좌표 차이는 같은 키로 묶이도록 함.
// - 값은 사용자에게 표시할 행정 주소 문자열(이미 formatAdministrativeAddress로 정리된 형태).
//
// 사용자 입력/외부 데이터가 키로 사용되지 않으므로 RegExp/XSS 위험은 없다.
// LRU eviction은 별도로 두지 않는다 (광고/마커 좌표 N은 사용자 1세션 동안 충분히 작음).
// ─────────────────────────────────────────────────────────────────────────────
const coordLocationCache = new Map<string, string>();

const makeCoordKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export const getCachedLocationName = (lat: number, lng: number): string | undefined => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return coordLocationCache.get(makeCoordKey(lat, lng));
};

export const setCachedLocationName = (lat: number, lng: number, name: string) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (!name) return;
  coordLocationCache.set(makeCoordKey(lat, lng), name);
};