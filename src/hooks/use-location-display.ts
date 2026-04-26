"use client";

import { useState, useEffect, useRef } from "react";
import { resolveOfflineLocationName } from "@/utils/offline-location";

// 메모리 캐시: 좌표 키 → 전체 주소 문자열
const locationCache = new Map<string, string>();

/**
 * 위치 이름이 "동"만 있는 경우(공백 없음) 카카오 API로 역지오코딩하여
 * "시 구 동" 형태의 전체 주소를 반환합니다.
 * 이미 "시 구" 이상의 정보가 있으면 그대로 반환합니다.
 */
function needsEnrichment(locationName: string): boolean {
  if (!locationName || locationName === "위치 정보 없음" || locationName === "알 수 없는 장소") return false;
  // 공백이 없으면 "동"만 있는 것으로 판단
  return !locationName.includes(" ");
}

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function reverseGeocodeKakao(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services?.Geocoder) {
      resolve(resolveOfflineLocationName(lat, lng));
      return;
    }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].address;
        // region_1depth_name: 시/도, region_2depth_name: 구/군, region_3depth_name: 동/읍/면
        const city = addr.region_1depth_name || "";
        const gu = addr.region_2depth_name || "";
        const dong = addr.region_3depth_name || "";
        const parts = [city, gu, dong].filter(Boolean);
        resolve(parts.join(" "));
      } else {
        resolve(resolveOfflineLocationName(lat, lng));
      }
    });
  });
}

export function useLocationDisplay(
  locationName: string,
  lat: number | undefined,
  lng: number | undefined
): string {
  const [displayLocation, setDisplayLocation] = useState(locationName);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!needsEnrichment(locationName) || !lat || !lng) {
      setDisplayLocation(locationName);
      return;
    }

    const cacheKey = getCacheKey(lat, lng);
    if (locationCache.has(cacheKey)) {
      setDisplayLocation(locationCache.get(cacheKey)!);
      return;
    }

    // 카카오 API가 아직 로드되지 않았을 수 있으므로 약간 지연 후 시도
    const tryResolve = async () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.services?.Geocoder) {
        // 카카오 미로드 시 오프라인 fallback
        const fallback = resolveOfflineLocationName(lat, lng);
        if (isMounted.current) setDisplayLocation(fallback);
        return;
      }
      const resolved = await reverseGeocodeKakao(lat, lng);
      locationCache.set(cacheKey, resolved);
      if (isMounted.current) setDisplayLocation(resolved);
    };

    tryResolve();
  }, [locationName, lat, lng]);

  return displayLocation;
}
