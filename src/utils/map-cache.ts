"use client";

import { Post } from "@/types";
import type { DirectionCounts } from "@/hooks/use-supabase-posts";

// 지도 화면의 상태를 메모리에 유지하여 페이지 이동 시 데이터 소실 방지
export const mapCache = {
  posts: [] as Post[],
  bounds: null as { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null,
  dbCounts: null as DirectionCounts | null,
  populatedTiles: new Set<string>(),
  // null로 초기화 - 사용자가 실제로 지도를 본 적 없으면 null
  lastCenter: null as { lat: number; lng: number } | null,
  lastZoom: 6,
  // 현재 위치 마커는 지도 페이지가 언마운트되어도 유지
  userLocation: null as { lat: number; lng: number } | null,
  // Write 페이지 등에서 돌아올 때 현재 위치로 자동이동하지 않도록 하는 플래그
  keepPosition: false,
  // 앱 세션에서 지도 최초 진입 시 자동 현재위치 이동을 이미 시도했는지 여부
  didInitialAutoLocate: false,
  // "신규 마커는 없지만 24h 지난 추억이 있는 영역" 카운트 캐시
  // 키: 양자화된 bounds + 필터 시그니처, 값: { count, timestamp }
  // 같은 영역에서 페이지 재진입/미세 이동 시 DB 재쿼리를 막아 부하를 줄임.
  expiredCountCache: new Map<string, { count: number; timestamp: number }>(),
};

/** 캐시 TTL (ms) — 이 시간 안에는 같은 영역에 대해 DB를 재쿼리하지 않음 */
export const EXPIRED_COUNT_CACHE_TTL_MS = 60_000;
/** 캐시 최대 엔트리 수 — 메모리 보호용 */
export const EXPIRED_COUNT_CACHE_MAX = 50;

/**
 * bounds를 소수점 3자리(~100m)로 양자화한 키 + 필터 시그니처를 만든다.
 * 미세 이동/패닝에는 캐시가 히트되고, 의미 있는 이동에만 새 키가 생성된다.
 */
export const makeExpiredCountKey = (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  filters: { categories: string[]; userId: string | null | undefined; followingIds: string[] }
): string => {
  const q = (n: number) => Math.round(n * 1000) / 1000;
  const b = `${q(bounds.sw.lat)},${q(bounds.sw.lng)}|${q(bounds.ne.lat)},${q(bounds.ne.lng)}`;
  const cats = [...filters.categories].sort().join(',');
  const uid = filters.userId || '';
  const fIds = filters.followingIds.length;
  return `${b}::${cats}::${uid}::f${fIds}`;
};