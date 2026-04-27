"use client";

import { useMemo } from "react";
import { resolveOfflineLocationName } from "@/utils/offline-location";

/**
 * location_name이 "동"만 있는 경우(공백 없음) 좌표 기반 오프라인 매핑으로
 * "시 구" 정보를 앞에 붙여 "서울시 강남구 대치2동" 형태로 반환합니다.
 * 카카오 API를 전혀 사용하지 않아 API 호출 낭비가 없습니다.
 */
function needsEnrichment(locationName: string): boolean {
  if (!locationName || locationName === "위치 정보 없음" || locationName === "알 수 없는 장소") return false;
  // 공백이 없으면 "동"만 있는 것으로 판단
  return !locationName.includes(" ");
}

export function useLocationDisplay(
  locationName: string,
  lat: number | undefined,
  lng: number | undefined
): string {
  return useMemo(() => {
    if (!needsEnrichment(locationName)) return locationName;
    if (!lat || !lng) return locationName;

    // 좌표로 "시 구" 정보를 오프라인 매핑에서 가져옴
    const cityGu = resolveOfflineLocationName(lat, lng); // e.g. "서울시 강남구"
    // cityGu 뒤에 원래 동 이름을 붙임 → "서울시 강남구 대치2동"
    return `${cityGu} ${locationName}`;
  }, [locationName, lat, lng]);
}
