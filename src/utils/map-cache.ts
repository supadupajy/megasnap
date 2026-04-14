"use client";

import { Post } from "@/types";

// 지도 화면의 상태를 메모리에 유지하여 페이지 이동 시 데이터 소실 방지
export const mapCache = {
  posts: [] as Post[],
  populatedTiles: new Set<string>(),
  lastCenter: { lat: 37.5665, lng: 126.9780 } as { lat: number; lng: number },
  lastZoom: 14
};