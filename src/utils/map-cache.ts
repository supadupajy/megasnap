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
};