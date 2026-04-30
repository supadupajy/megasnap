"use client";

import { Post } from "@/types";

// 지도 화면의 상태를 메모리에 유지하여 페이지 이동 시 데이터 소실 방지
export const mapCache = {
  posts: [] as Post[],
  populatedTiles: new Set<string>(),
  // null로 초기화 - 사용자가 실제로 지도를 본 적 없으면 null
  lastCenter: null as { lat: number; lng: number } | null,
  lastZoom: 6
};
