"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, RefreshCw } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';
import { getFallbackImage, getOptimizedMarkerImage } from '@/lib/utils';
import HeatmapOverlay from '@/components/HeatmapOverlay';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
  level?: number;
  searchResultLocation?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  draggable?: boolean;
  hideUserLocation?: boolean;
  /**
   * 롱프레스 토스트("지도 보기" / "손을 떼면 마커가 다시 나타납니다")가 표시될 상단 오프셋(px).
   * 보통 상단 트렌딩/마커 인디케이터의 아랫변 좌표를 전달한다.
   * 미지정 시 안전영역 + 헤더 높이만큼 기본값으로 표시.
   */
  toastTopOffset?: number;
}

const FALLBACK_IMAGE = "/placeholder.svg";

const KAKAO_MAPS_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=79d8615ee18c3979de0b737fd62b2f90&libraries=services,clusterer&autoload=false';
const KAKAO_MAPS_SCRIPT_ID = 'kakao-maps-sdk';
let kakaoMapsSdkPromise: Promise<void> | null = null;

const loadKakaoMapsSdk = () => {
  const win = window as any;
  if (win.kakao?.maps?.Map && win.kakao?.maps?.LatLng) return Promise.resolve();
  if (kakaoMapsSdkPromise) return kakaoMapsSdkPromise;

  kakaoMapsSdkPromise = new Promise<void>((resolve, reject) => {
    const completeLoad = () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps) {
        reject(new Error('Kakao Maps SDK is unavailable'));
        return;
      }
      if (kakao.maps.Map && kakao.maps.LatLng) {
        resolve();
        return;
      }
      if (typeof kakao.maps.load === 'function') {
        kakao.maps.load(() => resolve());
      } else {
        resolve();
      }
    };

    const existingScript = document.getElementById(KAKAO_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if ((window as any).kakao?.maps) completeLoad();
      else {
        existingScript.addEventListener('load', completeLoad, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Kakao Maps SDK')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_MAPS_SCRIPT_ID;
    script.type = 'text/javascript';
    script.async = true;
    script.src = KAKAO_MAPS_SDK_URL;
    script.onload = completeLoad;
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'));
    document.head.appendChild(script);
  }).catch((error) => {
    kakaoMapsSdkPromise = null;
    throw error;
  });

  return kakaoMapsSdkPromise;
};

const LONG_PRESS_DURATION = 1000; // 1초
const LONG_PRESS_MOVE_THRESHOLD = 5; // px 이상 움직이면 취소 (드래그 감지를 빠르게)

// ── 마커 24시간 만료 관련 상수 ────────────────────────────────────────
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000; // 24시간
const MARKER_EXPIRY_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 만료/타이머 갱신

// 카운트다운 링 사각 둥근 테두리 파라미터 (60×60 마커 inner box 안쪽)
// inner box: width=60, height=60, border-radius=20, border=4.5px
// 외곽 테두리 바로 안쪽에 딱 붙도록 padding을 최소화 → 좋아요 카운트 가리지 않음
// stroke-width=4의 절반(=2)만큼만 안으로 들여 외곽 테두리에 거의 붙임
const COUNTDOWN_RING_PADDING = 2; // 마커 박스 가장자리에서 안쪽으로 들이는 픽셀
const COUNTDOWN_RING_BOX = 60;    // viewBox 크기 (마커 inner box 크기와 동일)
const COUNTDOWN_RING_SIZE = COUNTDOWN_RING_BOX - COUNTDOWN_RING_PADDING * 2; // 사각 변 길이 = 56
const COUNTDOWN_RING_R = 16;      // 둥근 모서리 반지름 (마커 border-radius=20에 맞춰 살짝 작게)

// 카운트다운 링 컬러 (LocationButtonWithTimer와 통일)
// 남은 시간: 형광 네온 그린 / 지난 시간: 진한 초록 (opacity ↑)
const COUNTDOWN_PROGRESS_COLOR = '#39FF14';            // 형광 네온 그린 — 남은 시간
const COUNTDOWN_TRACK_COLOR = 'rgba(34,197,94,0.55)';  // 진한 초록(opacity 0.55) — 지난 시간
const COUNTDOWN_GLOW = '0 0 4px rgba(57,255,20,0.7)';  // 네온 발광

/**
 * 12시 방향(상단 중앙)에서 시작해, 시계 반대방향으로 한 바퀴 도는
 * 둥근 사각형 SVG path를 생성한다.
 * → stroke-dashoffset을 음수로 늘리면 시작점에서부터 stroke가 깎여나가므로,
 *    "남은 끝점"이 시계 반대방향으로 회전하면서 줄어드는 효과가 된다.
 */
const buildCountdownRingPath = (): string => {
  const pad = COUNTDOWN_RING_PADDING;
  const size = COUNTDOWN_RING_SIZE;
  const r = COUNTDOWN_RING_R;
  // 사각형 꼭짓점 좌표 (반지름 r만큼 안쪽에서 시작/종료)
  const left = pad;
  const right = pad + size;
  const top = pad;
  const bottom = pad + size;
  const cx = pad + size / 2; // 상단 중앙 시작점 x
  // 12시 방향(상단 중앙) → 시계 반대방향(왼쪽으로) 한 바퀴
  // M cx,top                         시작: 상단 중앙
  // H left + r                       ↖ 상단을 왼쪽으로
  // A r,r 0 0 0 left,top + r         ↶ 좌상 모서리(반시계)
  // V bottom - r                     ↙ 왼쪽 변 따라 아래로
  // A r,r 0 0 0 left + r,bottom      ↶ 좌하 모서리(반시계)
  // H right - r                      ↘ 하단을 오른쪽으로
  // A r,r 0 0 0 right,bottom - r     ↶ 우하 모서리(반시계)
  // V top + r                        ↗ 오른쪽 변 따라 위로
  // A r,r 0 0 0 right - r,top        ↶ 우상 모서리(반시계)
  // Z                                상단 중앙으로 닫기
  return `M ${cx} ${top} H ${left + r} A ${r} ${r} 0 0 0 ${left} ${top + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${right - r} A ${r} ${r} 0 0 0 ${right} ${bottom - r} V ${top + r} A ${r} ${r} 0 0 0 ${right - r} ${top} Z`;
};

/**
 * 둥근 사각형 path의 총 둘레 길이 (대략):
 *   직선 4개 + 코너 4개 호
 *   직선 길이: 각 변의 (size - 2r) → 4 * (size - 2r)
 *   호 길이: 코너 4개 합 = 2 * π * r (4개의 90도 호 = 1개의 원)
 */
const COUNTDOWN_RING_PERIMETER =
  4 * (COUNTDOWN_RING_SIZE - 2 * COUNTDOWN_RING_R) + 2 * Math.PI * COUNTDOWN_RING_R;

const COUNTDOWN_RING_PATH = buildCountdownRingPath();

/** 포스트의 createdAt(Date | string | undefined)에서 ms timestamp 추출. 없으면 null. */
const getPostCreatedAtMs = (post: any): number | null => {
  const raw = post?.createdAt ?? post?.created_at;
  if (!raw) return null;
  if (raw instanceof Date) return raw.getTime();
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
};

/** 포스트가 24시간 만료 룰의 적용 대상인지 (광고는 제외) */
const isMarkerExpirable = (post: any): boolean => {
  if (!post) return false;
  if (post.isAd) return false;
  if (post.isAdPending) return false;
  return true;
};

/** 포스트가 24시간 지나 만료되었는지 */
const isMarkerExpired = (post: any, now: number = Date.now()): boolean => {
  if (!isMarkerExpirable(post)) return false;
  const createdMs = getPostCreatedAtMs(post);
  if (createdMs === null) return false;
  return now - createdMs >= MARKER_LIFESPAN_MS;
};

const MapContainer = ({
  posts,
  viewedPostIds,
  onMarkerClick,
  onMapChange,
  onMapClick,
  center,
  level = 6,
  searchResultLocation,
  userLocation,
  draggable = true,
  hideUserLocation = false,
  toastTopOffset,
}: MapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(() => !(mapCache.posts.length > 0 && !!(window as any).kakao?.maps?.Map));
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(6);
  const [internalViewedIds, setInternalViewedIds] = useState<Set<string>>(new Set());
  const [mapInstanceState, setMapInstanceState] = useState<any>(null);
  const [userLocationPixel, setUserLocationPixel] = useState<{ x: number; y: number } | null>(null);

  // ── 마커 숨김 관련 상태 (React state는 UI 표시용만, 실제 동작은 ref로) ──
  const [uiState, setUiState] = useState<'idle' | 'pressing' | 'hidden'>('idle');
  const markersHiddenRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressingRef = useRef(false);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 토스트 표시 딜레이용
  // CSS 애니메이션용 - 누르기 시작 시각
  const pressStartTimeRef = useRef<number>(0);

  const overlaysRef = useRef<Map<string, any>>(new Map());
  const cachedMarkerIdsOnMountRef = useRef<Set<string>>(new Set(mapCache.posts.map(post => String(post.id))));
  const removalTimeoutsRef = useRef<Map<string, number>>(new Map());
  const searchOverlayRef = useRef<any>(null);
  const highlightingIdsRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const lastDragEnd = useRef(0);
  const currentLevelRef = useRef<number>(6);
  const lastReportedLevelRef = useRef<number | null>(null);
  const postsRef = useRef<any[]>(posts);
  const viewedPostIdsRef = useRef<Set<any>>(viewedPostIds);
  const internalViewedIdsRef = useRef<Set<string>>(new Set());
  const overlapBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportVisibilityRef = useRef<Map<string, boolean>>(new Map());
  const viewportAnimationFrameRef = useRef<number | null>(null);
  const viewportAnimationTimersRef = useRef<Map<string, number>>(new Map());
  // 드래그 중에는 viewport 애니메이션 트리거를 보류했다가 dragend에서 한 번에 평가
  const isDraggingViewportRef = useRef(false);

  // 비디오 썸네일 캐시: postId → dataURL
  const videoThumbCacheRef = useRef<Map<string, string>>(new Map());
  // 현재 추출 중인 postId 집합 (중복 추출 방지)
  const videoThumbPendingRef = useRef<Set<string>>(new Set());
  // extractVideoThumbnailForMarker를 ref로 감싸서 마커 생성 useEffect에서 stale closure 없이 참조
  const extractVideoThumbRef = useRef<(postId: string, videoUrl: string) => void>(() => {});

  const centerRef = useRef(center);
  const levelRef = useRef(6);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { levelRef.current = level; }, [level]);

  // 히트맵 points: 좌표 시그니처가 같으면 같은 배열 참조를 유지해
  // HeatmapOverlay의 redraw 트리거가 불필요하게 발생하지 않도록 메모화
  const heatmapPoints = useMemo(() => {
    return posts
      .filter(p => p.lat != null && p.lng != null)
      .map(p => ({ lat: p.lat as number, lng: p.lng as number }));
    // posts 자체가 변경됐을 때만 재계산
  }, [posts]);

  // draggable prop 변경 시 카카오맵 드래그 활성/비활성
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    mapInstance.current.setDraggable(draggable);
  }, [draggable, isMapReady]);

  const { user: authUser } = useAuth();

  const onMapChangeRef = useRef(onMapChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  const getMarkerInnerHtmlRef = useRef<(post: any, isViewed: boolean) => string>(() => '' );
  const authUserRef = useRef(authUser);

  useEffect(() => { onMapChangeRef.current = onMapChange; }, [onMapChange]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);
  useEffect(() => { viewedPostIdsRef.current = viewedPostIds; }, [viewedPostIds]);
  useEffect(() => { internalViewedIdsRef.current = internalViewedIds; }, [internalViewedIds]);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

  const isOverlayInsideViewport = useCallback((overlay: any) => {
    const map = mapInstance.current;
    if (!map) return true;

    try {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const position = overlay.getPosition();
      const lat = position.getLat();
      const lng = position.getLng();

      return (
        lat >= Math.min(sw.getLat(), ne.getLat()) &&
        lat <= Math.max(sw.getLat(), ne.getLat()) &&
        lng >= Math.min(sw.getLng(), ne.getLng()) &&
        lng <= Math.max(sw.getLng(), ne.getLng())
      );
    } catch {
      return true;
    }
  }, []);

  const clearViewportAnimationTimer = useCallback((id: string) => {
    const timer = viewportAnimationTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      viewportAnimationTimersRef.current.delete(id);
    }
  }, []);

  const applyMarkerViewportState = useCallback((id: string, overlay: any, isVisible: boolean, animate = true) => {
    const content = overlay.getContent() as HTMLElement | null;
    if (!content || content.classList.contains('marker-disappear-animation')) return;

    const wasVisible = viewportVisibilityRef.current.get(id);
    if (wasVisible === isVisible) return;

    viewportVisibilityRef.current.set(id, isVisible);
    clearViewportAnimationTimer(id);
    content.classList.remove('marker-viewport-appearing', 'marker-viewport-disappearing');

    if (isVisible) {
      content.classList.remove('marker-viewport-hidden');
      if (animate && !markersHiddenRef.current) {
        void content.offsetWidth;
        content.classList.add('marker-viewport-appearing');
        const timer = window.setTimeout(() => {
          content.classList.remove('marker-viewport-appearing');
          viewportAnimationTimersRef.current.delete(id);
        }, 680);
        viewportAnimationTimersRef.current.set(id, timer);
      }
      return;
    }

    if (animate && !markersHiddenRef.current) {
      void content.offsetWidth;
      content.classList.add('marker-viewport-disappearing');
      const timer = window.setTimeout(() => {
        content.classList.remove('marker-viewport-disappearing');
        content.classList.add('marker-viewport-hidden');
        viewportAnimationTimersRef.current.delete(id);
      }, content.classList.contains('is-ad') ? 520 : 420);
      viewportAnimationTimersRef.current.set(id, timer);
    } else {
      content.classList.add('marker-viewport-hidden');
    }
  }, [clearViewportAnimationTimer]);

  const updateMarkerViewportVisibility = useCallback((animate = true) => {
    if (!mapInstance.current || currentLevelRef.current >= 7) return;
    // 드래그 중에는 평가/애니메이션을 보류 (dragend에서 한 번에 처리)
    if (isDraggingViewportRef.current) return;

    overlaysRef.current.forEach((overlay, id) => {
      applyMarkerViewportState(String(id), overlay, isOverlayInsideViewport(overlay), animate);
    });
  }, [applyMarkerViewportState, isOverlayInsideViewport]);

  const scheduleMarkerViewportVisibilityUpdate = useCallback((animate = true) => {
    if (isDraggingViewportRef.current) return;
    if (viewportAnimationFrameRef.current !== null) return;
    viewportAnimationFrameRef.current = window.requestAnimationFrame(() => {
      viewportAnimationFrameRef.current = null;
      updateMarkerViewportVisibility(animate);
    });
  }, [updateMarkerViewportVisibility]);

  useEffect(() => {
    return () => {
      if (viewportAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportAnimationFrameRef.current);
        viewportAnimationFrameRef.current = null;
      }
      viewportAnimationTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      viewportAnimationTimersRef.current.clear();
    };
  }, []);

  // ── 마커 DOM 직접 숨김/표시 (클래스 토글로 !important CSS 활용) ──────
  const hideAllMarkersDom = useCallback(() => {
    overlaysRef.current.forEach((overlay) => {
      const content = overlay.getContent() as HTMLElement;
      if (content) {
        content.classList.remove('markers-revealing');
        content.classList.add('markers-hidden');
        // 배지도 함께 숨김
        const badge = content.querySelector('.overlap-badge') as HTMLElement | null;
        if (badge) badge.style.opacity = '0';
      }
    });
    if (searchOverlayRef.current) {
      const c = searchOverlayRef.current.getContent() as HTMLElement;
      if (c) { c.style.transition = 'opacity 0.25s ease-out'; c.style.opacity = '0'; }
    }
  }, []);

  const showAllMarkersDom = useCallback(() => {
    overlaysRef.current.forEach((overlay) => {
      const content = overlay.getContent() as HTMLElement;
      if (content) {
        content.classList.remove('markers-hidden');
        content.classList.add('markers-revealing');
        // 배지 복원
        const badge = content.querySelector('.overlap-badge') as HTMLElement | null;
        if (badge) badge.style.opacity = '1';
      }
    });
    if (searchOverlayRef.current) {
      const c = searchOverlayRef.current.getContent() as HTMLElement;
      if (c) { c.style.transition = 'opacity 0.45s ease'; c.style.opacity = '1'; }
    }
  }, []);

  // ── 롱프레스 취소 ──────────────────────────────────────────────────────
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (showToastTimerRef.current) {
      clearTimeout(showToastTimerRef.current);
      showToastTimerRef.current = null;
    }
    isLongPressingRef.current = false;
    pressStartPosRef.current = null;
    setUiState(prev => prev === 'pressing' ? 'idle' : prev);
  }, []);

  // ── 롱프레스 시작 ──────────────────────────────────────────────────────
  const startLongPress = useCallback((x: number, y: number) => {
    if (markersHiddenRef.current) return;
    if (isLongPressingRef.current) return;

    isLongPressingRef.current = true;
    pressStartPosRef.current = { x, y };
    pressStartTimeRef.current = Date.now();
    // 토스트는 0.5초 후에 표시 (그 전에 드래그하면 취소됨)
    showToastTimerRef.current = setTimeout(() => {
      showToastTimerRef.current = null;
      if (isLongPressingRef.current) {
        setUiState('pressing');
      }
    }, 500);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressingRef.current = false;
      pressStartPosRef.current = null;
      markersHiddenRef.current = true;
      hideAllMarkersDom();
      setUiState('hidden');
    }, LONG_PRESS_DURATION);
  }, [hideAllMarkersDom]);

  // ── 손 뗄 때 ──────────────────────────────────────────────────────────
  const revealMarkersOnce = useCallback(() => {
    // 이미 복원됐거나 복원 예약 중이면 중복 실행 방지
    if (!markersHiddenRef.current) return;
    if (revealTimerRef.current) return;
    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = null;
      markersHiddenRef.current = false;
      showAllMarkersDom();
      setUiState('idle');
    }, 60);
  }, [showAllMarkersDom]);

  const handlePointerUp = useCallback(() => {
    if (isLongPressingRef.current) {
      cancelLongPress();
      return;
    }
    revealMarkersOnce();
  }, [cancelLongPress, revealMarkersOnce]);

  // ── 터치/마우스 이벤트 등록 ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.marker-container') || target.closest('.search-result-marker-container')) return;
      if (e.touches.length === 1) {
        startLongPress(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      handlePointerUp();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isLongPressingRef.current || !pressStartPosRef.current) return;
      const dx = e.touches[0].clientX - pressStartPosRef.current.x;
      const dy = e.touches[0].clientY - pressStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
        cancelLongPress();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.marker-container') || target.closest('.search-result-marker-container')) return;
      startLongPress(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handlePointerUp();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isLongPressingRef.current || !pressStartPosRef.current) return;
      const dx = e.clientX - pressStartPosRef.current.x;
      const dy = e.clientY - pressStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
        cancelLongPress();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
    };
  }, [startLongPress, handlePointerUp, cancelLongPress]);

  // 카카오맵 dragstart/dragend → 롱프레스 취소 및 마커 복원
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    // 드래그 시작 시 롱프레스 즉시 취소
    const handleDragStart = () => { cancelLongPress(); };

    // 드래그 끝날 때 마커 숨김 상태면 복원
    const handleDragEnd = () => { revealMarkersOnce(); };

    kakao.maps.event.addListener(mapInstance.current, 'dragstart', handleDragStart);
    kakao.maps.event.addListener(mapInstance.current, 'dragend', handleDragEnd);
    return () => {
      kakao.maps.event.removeListener(mapInstance.current, 'dragstart', handleDragStart);
      kakao.maps.event.removeListener(mapInstance.current, 'dragend', handleDragEnd);
    };
  }, [isMapReady, cancelLongPress, revealMarkersOnce]);

  // ── 현재 위치 픽셀 좌표 계산 (지도 이동/줌 시 갱신) ──────────────────
  const updateUserLocationPixel = useCallback(() => {
    if (!userLocation || !mapInstanceState) {
      setUserLocationPixel(null);
      return;
    }
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const map = mapInstanceState;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const container = containerRef.current;
    if (!container) return;
    const W = container.offsetWidth;
    const H = container.offsetHeight;
    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;
    const x = ((userLocation.lng - sw.getLng()) / lngRange) * W;
    const y = (1 - (userLocation.lat - sw.getLat()) / latRange) * H;
    setUserLocationPixel({ x, y });
  }, [userLocation, mapInstanceState, containerRef]);

  useEffect(() => {
    updateUserLocationPixel();
  }, [updateUserLocationPixel]);

  useEffect(() => {
    if (!mapInstanceState) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const handleUpdate = () => updateUserLocationPixel();
    kakao.maps.event.addListener(mapInstanceState, 'idle', handleUpdate);
    kakao.maps.event.addListener(mapInstanceState, 'drag', handleUpdate);
    kakao.maps.event.addListener(mapInstanceState, 'zoom_changed', handleUpdate);
    return () => {
      kakao.maps.event.removeListener(mapInstanceState, 'idle', handleUpdate);
      kakao.maps.event.removeListener(mapInstanceState, 'drag', handleUpdate);
      kakao.maps.event.removeListener(mapInstanceState, 'zoom_changed', handleUpdate);
    };
  }, [mapInstanceState, updateUserLocationPixel]);

  // ── 기존 이벤트 핸들러들 ──────────────────────────────────────────────

  useEffect(() => {
    const handleUpdateViewedMarkers = (e: any) => {
      const ids = e.detail?.viewedIds;
      if (Array.isArray(ids)) {
        setInternalViewedIds(new Set(ids));
      }
    };
    window.addEventListener('update-viewed-markers', handleUpdateViewedMarkers);
    return () => window.removeEventListener('update-viewed-markers', handleUpdateViewedMarkers);
  }, []);

  useEffect(() => {
    const handleAnimateDelete = (e: any) => {
      const postId = e.detail?.id;
      if (!postId) return;
      try {
        const overlay = overlaysRef.current.get(postId);
        if (overlay) {
          const content = overlay.getContent();
          if (content instanceof HTMLElement) {
            content.classList.remove('marker-appear-animation');
            content.classList.add('marker-disappear-animation');
            content.style.pointerEvents = 'none';
          }
          setTimeout(() => {
            if (overlaysRef.current.has(postId)) {
              const targetOverlay = overlaysRef.current.get(postId);
              targetOverlay?.setMap(null);
              overlaysRef.current.delete(postId);
              viewportVisibilityRef.current.delete(String(postId));
              clearViewportAnimationTimer(String(postId));
            }
          }, 520);
        }
      } catch (err) {
        console.error('[MapContainer] Delete animation error:', err);
      }
    };
    window.addEventListener('animate-marker-delete', handleAnimateDelete);
    return () => window.removeEventListener('animate-marker-delete', handleAnimateDelete);
  }, [clearViewportAnimationTimer]);

  useEffect(() => {
    const originalGetRangeAt = Selection.prototype.getRangeAt;
    Selection.prototype.getRangeAt = function(index: number) {
      if (this.rangeCount <= index || index < 0) return document.createRange();
      try { return originalGetRangeAt.apply(this, [index]); }
      catch (e) { return document.createRange(); }
    };

    const originalAddRange = Selection.prototype.addRange;
    Selection.prototype.addRange = function(range: Range) {
      try { return originalAddRange.apply(this, [range]); } catch (e) {}
    };

    const preventSelectionError = () => {
      if (window.getSelection) {
        try {
          const sel = window.getSelection();
          if (sel) {
            if (sel.rangeCount > 0) sel.removeAllRanges();
            if (document.activeElement instanceof HTMLElement && 
                containerRef.current?.contains(document.activeElement)) {
              document.activeElement.blur();
            }
          }
        } catch (err) {}
      }
    };

    const container = containerRef.current;
    if (container) {
      const events = ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu', 'selectstart', 'dragstart'];
      events.forEach(evt => container.addEventListener(evt, preventSelectionError, { capture: true, passive: true }));
    }

    const handleError = (e: ErrorEvent) => {
      if (e.message?.includes('getRangeAt') || e.message?.includes('IndexSizeError')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('error', handleError, true);

    return () => {
      Selection.prototype.getRangeAt = originalGetRangeAt;
      Selection.prototype.addRange = originalAddRange;
      window.removeEventListener('error', handleError, true);
      if (container) {
        const events = ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu', 'selectstart', 'dragstart'];
        events.forEach(evt => container.removeEventListener(evt, preventSelectionError, { capture: true } as any));
      }
    };
  }, []);

  // 구식 핀치 차단 useEffect 제거됨 - 새로운 부드러운 줌 useEffect로 대체

  const initMap = useCallback(() => {
    try {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.Map || !kakao?.maps?.LatLng || !containerRef.current) return false;
      if (mapInstance.current) {
        setIsLoading(false);
        setMapLoadError(null);
        return true;
      }

      // 카카오맵 초기 위치는 항상 mapCache.lastCenter(이전 세션 마지막 위치) 사용

      // centerRef.current(현재 prop)를 사용하면 routeState로 즉시 post 위치가 들어와
      // smoothMoveTo가 작동하지 않고 순간이동처럼 보이는 문제 발생
      const initialCenter = mapCache.lastCenter || { lat: 37.5665, lng: 126.9780 };
      const initialLevel = levelRef.current ?? 6;
      const map = new kakao.maps.Map(containerRef.current!, {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: initialLevel,
        disableDoubleClickZoom: true,
      });
      map.setMaxLevel(11);
      map.setMinLevel(3);
      mapInstance.current = map;
      setMapInstanceState(map);

      const updateZoomClass = () => {
        const lvl = map.getLevel();
        const el = containerRef.current;
        if (!el) return;
        el.className = el.className.replace(/\bzoom-\d+\b/g, '');
        el.classList.add(`zoom-${lvl}`);
      };

      const updateMapData = (forceInitial = false) => {
        // 댓글 입력/키보드로 visualViewport가 바뀌는 동안 카카오맵이 idle/zoom_changed를 내보내도
        // 지도 상태를 앱에 보고하지 않음. 실제 사용자 지도 조작이 아니므로 위치 튐을 방지한다.
        if (!forceInitial && (window as any).__commentsDialogOpen) return;
        // smoothMoveTo 진행 중에는 idle/zoom_changed 이벤트 무시
        // (이동 중 onMapChange 호출 → React 리렌더 → center useEffect 재실행 → smoothMoveTo 재시작 → 순간이동)
        // 단, 초기 강제 호출(forceInitial=true)은 animationFrame 체크를 건너뜀
        if (!forceInitial && animationFrameRef.current) return;
        try {
          const bounds = map.getBounds();
          const currentCenter = map.getCenter();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const mapLevel = map.getLevel();
          currentLevelRef.current = mapLevel;
          lastReportedLevelRef.current = mapLevel;
          setCurrentLevel(prev => (prev === mapLevel ? prev : mapLevel));
          if (levelTimerRef.current) {
            clearTimeout(levelTimerRef.current);
            levelTimerRef.current = null;
          }
          updateZoomClass();
          const boundsData = {
            sw: { lat: sw.getLat(), lng: sw.getLng() },
            ne: { lat: ne.getLat(), lng: ne.getLng() }
          };
          
          localStorage.setItem('map_bounds', JSON.stringify(boundsData));
          onMapChangeRef.current({
            bounds: boundsData,
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: mapLevel,
          });
        } catch (e) {}
      };

      setIsMapReady(true);
      setIsLoading(false);
      setMapLoadError(null);

      updateZoomClass();

      const relayoutInitialMap = () => {
        try {
          map.relayout();
          map.setCenter(new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng));
          updateZoomClass();
        } catch (e) {}
      };
      requestAnimationFrame(relayoutInitialMap);
      setTimeout(relayoutInitialMap, 250);

      // 카카오맵은 최초 생성 시 idle 이벤트를 발생시키지 않으므로
      // 지도 초기화 직후 수동으로 onMapChange를 호출해 초기 bounds fetch를 트리거.
      // relayout() 후 getBounds()가 유효한 값을 반환할 때까지 재시도한다.
      // tilesloaded: 지도 타일이 완전히 로드된 후 발생 → getBounds()가 항상 유효
      // 최초 1회만 실행 (이후 idle 이벤트가 담당)
      let initialUpdateDone = false;
      const handleTilesLoaded = () => {
        if (initialUpdateDone) return;
        initialUpdateDone = true;
        updateMapData(true);
      };
      kakao.maps.event.addListener(map, 'tilesloaded', handleTilesLoaded);

      // tilesloaded가 이미 발생했을 경우를 대비한 폴백 (500ms 후 시도)
      setTimeout(() => {
        if (!initialUpdateDone && mapInstance.current) {
          try {
            const bounds = mapInstance.current.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            if (sw.getLat() !== ne.getLat() || sw.getLng() !== ne.getLng()) {
              initialUpdateDone = true;
              updateMapData(true);
            }
          } catch (e) {}
        }
      }, 500);

      kakao.maps.event.addListener(map, 'idle', updateMapData);

      // zoom_changed: 레벨 즉시 전달 (idle보다 먼저 발생하므로 레벨 7 전환 시 마커 깜빡임 방지)
      // 단, onMapChangeRef는 여기서만 호출 (별도 useEffect의 zoom_changed 리스너와 중복 방지)
      kakao.maps.event.addListener(map, 'zoom_changed', updateMapData);
      
      kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        if (onMapClickRef.current) {
          const latlng = mouseEvent.latLng;
          onMapClickRef.current({ lat: latlng.getLat(), lng: latlng.getLng() });
        }
      });

      return true;
    } catch (e) { return false; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      timers.push(timer);
    };

    const applyInitialLevel = () => {
      if (mapInstance.current) {
        const targetLevel = levelRef.current ?? 6;
        mapInstance.current.setLevel(targetLevel, { animate: false });
        setCurrentLevel(targetLevel);
        currentLevelRef.current = targetLevel;
      }
    };

    const tryInitializeMap = (retryCount = 0) => {
      if (cancelled) return;
      const isInit = initMap();
      if (isInit) {
        applyInitialLevel();
        return;
      }
      if (retryCount < 40) {
        schedule(() => tryInitializeMap(retryCount + 1), 100);
        return;
      }
      setIsLoading(false);
      setMapLoadError('카카오지도를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
    };

    setIsLoading(!(mapCache.posts.length > 0 && !!(window as any).kakao?.maps?.Map));
    setMapLoadError(null);

    loadKakaoMapsSdk()
      .then(() => tryInitializeMap())
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
        setMapLoadError('카카오지도 SDK 로딩에 실패했습니다. iOS에서 계속 발생하면 Kakao Developers의 Web 플랫폼 도메인에 capacitor://localhost가 등록되어 있는지 확인해주세요.');
      });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initMap]);

  // level prop 변경 시 setLevel은 아래 isMapReady-gated useEffect 하나에서만 처리
  // (즉시 실행 useEffect를 제거 - zoom_changed 이벤트 중복 발생 방지)

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;

    // 레벨 7 이상이면 마커를 생성하지 않음 (zoom_changed에서 이미 제거됨)
    if (mapInstance.current && mapInstance.current.getLevel() >= 7) return;

    const combinedViewedIds = new Set([...Array.from(viewedPostIds), ...Array.from(internalViewedIds)]);
    const propPostIds = new Set(posts.map(p => p.id));

    overlaysRef.current.forEach((overlay, id) => {
      if (!propPostIds.has(id)) {
        const content = overlay.getContent() as HTMLElement;
        if (content && !content.classList.contains('marker-disappear-animation')) {
          content.classList.remove('marker-appear-animation');
          content.classList.add('marker-disappear-animation');
          content.style.pointerEvents = 'none';
          
          const removalTimer = window.setTimeout(() => {
            removalTimeoutsRef.current.delete(id);
            if (!propPostIds.has(id) && overlaysRef.current.has(id)) {
              overlay.setMap(null);
              overlaysRef.current.delete(id);
              viewportVisibilityRef.current.delete(String(id));
              clearViewportAnimationTimer(String(id));
            }
          }, 520);
          removalTimeoutsRef.current.set(id, removalTimer);
        } else if (!content) {
          overlay.setMap(null);
          overlaysRef.current.delete(id);
          viewportVisibilityRef.current.delete(String(id));
          clearViewportAnimationTimer(String(id));
        }
      }
    });

    const nowForExpiry = Date.now();
    posts.forEach(post => {
      if (!post || post.lat === null || post.lng === null) return;
      // 24시간 지난 일반 포스트(광고 제외)는 마커를 만들지 않음
      if (isMarkerExpired(post, nowForExpiry)) return;
      const position = new kakao.maps.LatLng(post.lat, post.lng);

      const isViewed = combinedViewedIds.has(post.id);
      const isNew = !!post.isNewRealtime;
      const existingOverlay = overlaysRef.current.get(post.id);
      const isMineKey = !!(authUser && String(((post as any).owner_id || (post as any).user_id || '')) === String(authUser.id));
      const isAdPendingKey = !!(post as any).isAdPending;
      // 비디오 썸네일 캐시 여부를 key에 포함 → 썸네일 추출 완료 시 마커 갱신 트리거
      const hasThumbKey = (!post.isAd && post.videoUrl) ? (videoThumbCacheRef.current.has(post.id) ? '1' : '0') : '';
      const contentStateKey = `${post.borderType}-${post.isAd}-${isNew}-${isMineKey}-${isAdPendingKey}-${post.likes}-${hasThumbKey}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        const isAdPost = post.isAd || (post.content && post.content.includes('[AD]'));
        const isInsideViewport = (() => {
          try {
            const bounds = mapInstance.current.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            return (
              post.lat >= Math.min(sw.getLat(), ne.getLat()) &&
              post.lat <= Math.max(sw.getLat(), ne.getLat()) &&
              post.lng >= Math.min(sw.getLng(), ne.getLng()) &&
              post.lng <= Math.max(sw.getLng(), ne.getLng())
            );
          } catch {
            return true;
          }
        })();
        const shouldAnimateMarkerAppear = isInsideViewport && !cachedMarkerIdsOnMountRef.current.has(String(post.id));
        content.className = `marker-container kakao-overlay${shouldAnimateMarkerAppear ? ' marker-appear-animation' : ''}`;
        if (isAdPost) content.classList.add('is-ad');
        if (!isInsideViewport) content.classList.add('marker-viewport-hidden');
        viewportVisibilityRef.current.set(String(post.id), isInsideViewport);
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        content.onclick = (e) => {
          e.stopPropagation();
          if (isDragging.current) return;
          onMarkerClickRef.current(post);
        };

        // 숨김 상태면 즉시 숨김 클래스 적용
        if (markersHiddenRef.current) {
          content.classList.add('markers-hidden');
        }

        const overlay = new kakao.maps.CustomOverlay({
          position: position,
          content: content,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300)
        });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);

        // 비디오 포스트이고 썸네일이 없으면 비동기로 추출
        if (!post.isAd && post.videoUrl) {
          const cachedThumb = videoThumbCacheRef.current.get(post.id);
          if (cachedThumb) {
            // 이미 캐시된 썸네일이 있으면 즉시 적용
            const img = content.querySelector('img') as HTMLImageElement | null;
            if (img) img.src = cachedThumb;
          } else {
            extractVideoThumbRef.current(post.id, post.videoUrl);
          }
        }
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        if (existingOverlay.getMap() === null) {
          existingOverlay.setMap(mapInstance.current);
        }
        
        if (content.getAttribute('data-content-state') !== contentStateKey) {
          if (!highlightingIdsRef.current.has(post.id)) {
            content.innerHTML = getMarkerInnerHtml(post, isViewed);
            content.setAttribute('data-content-state', contentStateKey);
            scheduleOverlapBadgeUpdateRef.current();
          } else {
            content.setAttribute('data-content-state', contentStateKey);
          }
        }
      }
    });

    scheduleMarkerViewportVisibilityUpdate(false);
  }, [posts, isMapReady, authUser, scheduleMarkerViewportVisibilityUpdate, clearViewportAnimationTimer]);

  useEffect(() => {
    if (!isMapReady) return;
    // 조회 상태는 포스트 리스트/상세 오버레이에서만 사용하고,
    // 지도 마커 DOM은 이미 로딩된 모양을 유지한다.
    // viewedPostIds 변경 때마다 innerHTML을 교체하면 지도 복귀 시 마커가 다시 로딩되는 것처럼 보인다.
  }, [viewedPostIds, internalViewedIds, isMapReady]);

  // 'pre-highlight-marker' 이벤트: focusPostOnMap에서 setAllPosts 직후 즉시 보호 시작
  // (smoothMoveTo 완료 전에 React 리렌더가 일어나도 innerHTML 교체 방지)
  useEffect(() => {
    const handlePreHighlight = (e: any) => {
      const postId = e.detail?.id;
      if (postId) highlightingIdsRef.current.add(postId);
    };
    window.addEventListener('pre-highlight-marker', handlePreHighlight);
    return () => window.removeEventListener('pre-highlight-marker', handlePreHighlight);
  }, []);

  useEffect(() => {
    const handleHighlight = (e: any) => {
      const postId = e.detail?.id;
      const duration = e.detail?.duration || 2500;

      if (!postId) return;

      // 즉시 highlightingIdsRef에 추가 - overlay를 찾기 전에 보호 시작
      // (300ms throttle 후 React 리렌더가 일어나도 innerHTML 교체 방지)
      highlightingIdsRef.current.add(postId);

      const tryHighlight = (retryCount = 0) => {
        const overlay = overlaysRef.current.get(postId);
        
        if (overlay) {
          const content = overlay.getContent() as HTMLElement;
          if (content) {
            overlaysRef.current.forEach((o, id) => {
              const c = o.getContent() as HTMLElement;
              if (c && c.classList.contains('highlighted') && id !== postId) {
                // highlighted 클래스만 제거 - innerHTML 교체 금지 (깜빡임 방지)
                c.classList.remove('highlighted');
                highlightingIdsRef.current.delete(id);
                const prevPost = postsRef.current.find(item => item.id === id);
                o.setZIndex(
                  prevPost?.isAd ? 500 :
                  (prevPost?.borderType !== 'none' ? 400 : 300)
                );
              }
            });

            // highlighted 진입 시 올바른 isMine HTML로 먼저 교체 후 data-content-state 동기화
            // (highlighted 중 React 리렌더가 일어나도 contentStateKey 일치 → innerHTML 교체 안 함)
            const pNow = postsRef.current.find(item => item.id === postId);
            if (pNow) {
              const isMineKeyNow = !!(authUserRef.current && String(((pNow as any).owner_id || (pNow as any).user_id || '')) === String(authUserRef.current.id));
              const isAdPendingKeyNow = !!(pNow as any).isAdPending;
              const hasThumbKeyNow = (!pNow.isAd && pNow.videoUrl) ? (videoThumbCacheRef.current.has(pNow.id) ? '1' : '0') : '';
              const nowStateKey = `${pNow.borderType}-${pNow.isAd}-${!!pNow.isNewRealtime}-${isMineKeyNow}-${isAdPendingKeyNow}-${pNow.likes}-${hasThumbKeyNow}`;
              content.innerHTML = getMarkerInnerHtmlRef.current(pNow, false);
              content.setAttribute('data-content-state', nowStateKey);
              scheduleOverlapBadgeUpdateRef.current();
            }
            // marker-appear-animation 제거 (innerHTML 교체 후이므로 안전)
            content.classList.remove('marker-appear-animation');
            // highlighted 추가
            content.classList.remove('highlighted');
            content.classList.add('highlighted');
            highlightingIdsRef.current.add(postId);
            overlay.setZIndex(99999);

            setTimeout(() => {
              if (!content || !content.classList.contains('highlighted')) {
                highlightingIdsRef.current.delete(postId);
                return;
              }
              // highlighted 제거 전에 올바른 innerHTML로 먼저 교체
              // (highlightingIdsRef 보호 해제 후 React 리렌더가 잘못된 isMine으로 교체하는 것 방지)
              const p2 = postsRef.current.find(item => item.id === postId);
              if (p2) {
                const isMineKey2 = !!(authUserRef.current && String(((p2 as any).owner_id || (p2 as any).user_id || '')) === String(authUserRef.current.id));
                const isAdPendingKey2 = !!(p2 as any).isAdPending;
                const hasThumbKey2 = (!p2.isAd && p2.videoUrl) ? (videoThumbCacheRef.current.has(p2.id) ? '1' : '0') : '';
                const finalStateKey = `${p2.borderType}-${p2.isAd}-${!!p2.isNewRealtime}-${isMineKey2}-${isAdPendingKey2}-${p2.likes}-${hasThumbKey2}`;
                content.innerHTML = getMarkerInnerHtmlRef.current(p2, false);
                content.setAttribute('data-content-state', finalStateKey);
                scheduleOverlapBadgeUpdateRef.current();
              }
              content.classList.remove('highlighted');
              highlightingIdsRef.current.delete(postId);
              overlay.setZIndex(p2?.isAd ? 500 : p2?.borderType !== 'none' ? 400 : 300);
            }, duration);
            return;
          }
        }

        if (retryCount < 15) {
          setTimeout(() => tryHighlight(retryCount + 1), 200);
        } else {
          // 재시도 포기 시 보호 해제
          highlightingIdsRef.current.delete(postId);
        }
      };

      tryHighlight();
    };

    window.addEventListener('highlight-marker', handleHighlight);
    return () => window.removeEventListener('highlight-marker', handleHighlight);
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    const map = mapInstance.current;
    const kakao = (window as any).kakao;

    const MIN_LEVEL = 3;
    let lastAllowedCenter: any = null;

    const handleZoom = () => {
      const level = map.getLevel();
      currentLevelRef.current = level;
      lastReportedLevelRef.current = level;
      setCurrentLevel(prev => (prev === level ? prev : level));
      if (levelTimerRef.current) {
        clearTimeout(levelTimerRef.current);
        levelTimerRef.current = null;
      }

      // 레벨 7 이상이면 React 렌더 사이클을 기다리지 않고 즉시 모든 마커 제거
      // disappear 애니메이션 없이 즉시 제거해야 깜빡임이 없음
      if (level >= 7) {
        overlaysRef.current.forEach((overlay) => {
          overlay.setMap(null);
        });
        overlaysRef.current.clear();
        viewportVisibilityRef.current.clear();
        // 진행 중인 removalTimeout도 모두 취소
        removalTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        removalTimeoutsRef.current.clear();
        viewportAnimationTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        viewportAnimationTimersRef.current.clear();
      }

      if (level === MIN_LEVEL) {
        lastAllowedCenter = map.getCenter();
      }

      const el = containerRef.current;
      if (el) {
        el.className = el.className.replace(/\bzoom-\d+\b/g, '');
        el.classList.add(`zoom-${level}`);
      }
      // NOTE: onMapChangeRef는 initMap의 zoom_changed 리스너(updateMapData)에서 호출됨
      // 여기서 중복 호출하지 않음
    };

    const handleIdle = () => {
      if (map.getLevel() === MIN_LEVEL) {
        lastAllowedCenter = map.getCenter();
      }
    };

    kakao.maps.event.addListener(map, 'zoom_changed', handleZoom);
    kakao.maps.event.addListener(map, 'idle', handleIdle);
    return () => {
      kakao.maps.event.removeListener(map, 'zoom_changed', handleZoom);
      kakao.maps.event.removeListener(map, 'idle', handleIdle);
    };
  }, [isMapReady]);

  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;

    const handleMarkerViewportChange = () => {
      scheduleMarkerViewportVisibilityUpdate(true);
    };

    const handleViewportDragStart = () => {
      isDraggingViewportRef.current = true;
    };

    const handleViewportDragEnd = () => {
      isDraggingViewportRef.current = false;
      // 드래그가 끝난 시점에 한 번에 화면 진입/이탈을 평가하여 애니메이션 트리거
      scheduleMarkerViewportVisibilityUpdate(true);
    };

    kakao.maps.event.addListener(map, 'dragstart', handleViewportDragStart);
    kakao.maps.event.addListener(map, 'dragend', handleViewportDragEnd);
    kakao.maps.event.addListener(map, 'center_changed', handleMarkerViewportChange);
    kakao.maps.event.addListener(map, 'idle', handleMarkerViewportChange);
    kakao.maps.event.addListener(map, 'zoom_changed', handleMarkerViewportChange);

    scheduleMarkerViewportVisibilityUpdate(false);

    return () => {
      kakao.maps.event.removeListener(map, 'dragstart', handleViewportDragStart);
      kakao.maps.event.removeListener(map, 'dragend', handleViewportDragEnd);
      kakao.maps.event.removeListener(map, 'center_changed', handleMarkerViewportChange);
      kakao.maps.event.removeListener(map, 'idle', handleMarkerViewportChange);
      kakao.maps.event.removeListener(map, 'zoom_changed', handleMarkerViewportChange);
    };
  }, [isMapReady, scheduleMarkerViewportVisibilityUpdate]);

  // level prop이 바뀌면 pendingLevelRef에 저장해두고,
  // smoothMoveTo가 진행 중이 아닐 때만 실제로 setLevel 적용
  const pendingLevelRef = useRef<number | null>(null);

  const applyLevel = useCallback((targetLevel: number) => {
    const map = mapInstance.current;
    if (!map) return;

    const currentMapLevel = map.getLevel();
    if (currentMapLevel === targetLevel) {
      currentLevelRef.current = currentMapLevel;
      lastReportedLevelRef.current = currentMapLevel;
      setCurrentLevel(prev => (prev === currentMapLevel ? prev : currentMapLevel));
      pendingLevelRef.current = null;
      return;
    }

    map.setLevel(targetLevel, { animate: false });
    const newLevel = map.getLevel();
    setCurrentLevel(newLevel);
    currentLevelRef.current = newLevel;
    lastReportedLevelRef.current = newLevel;
    pendingLevelRef.current = null;
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || level === undefined) return;

    const currentMapLevel = mapInstance.current.getLevel();
    if (currentMapLevel === level || lastReportedLevelRef.current === level) return;

    if (animationFrameRef.current) {
      // smoothMoveTo 진행 중 → 완료 후 적용하도록 pending에 저장
      pendingLevelRef.current = level;
      return;
    }

    applyLevel(level);
  }, [level, isMapReady, applyLevel]);

  const smoothMoveTo = (targetLat: number, targetLng: number, onComplete?: () => void) => {
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!map || !kakao || !kakao.maps?.LatLng) return;

    if (window.getSelection) window.getSelection()?.removeAllRanges();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    // level 변경 타이머가 이동 중에 실행되면 카카오맵이 center를 리셋하므로 취소
    if (levelTimerRef.current) {
      clearTimeout(levelTimerRef.current);
      levelTimerRef.current = null;
    }

    const startCenter = map.getCenter();
    const startLat = startCenter.getLat();
    const startLng = startCenter.getLng();
    const dist = Math.sqrt(Math.pow(targetLat - startLat, 2) + Math.pow(targetLng - startLng, 2));
    // 거리에 비례한 duration: 가까우면 빠르게, 멀면 최대 1500ms로 부드럽게
    // 최소 700ms 보장 → 같은 동네 안에서도 부드러운 애니메이션 체감
    const duration = Math.min(Math.max(dist * 1200, 700), 1500);
    const startTime = performance.now();

    // 히트맵 등 부가 레이어가 setCenter 매 프레임 redraw하지 않도록
    // programmatic 이동 시작을 알림 (캔버스 transform으로 따라가기 위함)
    try {
      window.dispatchEvent(new CustomEvent('map-programmatic-move-start'));
    } catch (e) {}

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentLat = startLat + (targetLat - startLat) * ease;
      const currentLng = startLng + (targetLng - startLng) * ease;

      try {
        map.setCenter(new kakao.maps.LatLng(currentLat, currentLng));
      } catch (e) {
        console.error('Smooth move error:', e);
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        try {
          window.dispatchEvent(new CustomEvent('map-programmatic-move-end'));
        } catch (e) {}
        // 이동 완료 후 pending level 적용
        if (pendingLevelRef.current !== null) {
          applyLevel(pendingLevelRef.current);
        }
        // 이동 완료 후 최종 위치를 onMapChange로 알림 (이동 중 억제했던 idle 이벤트 대체)
        try {
          const finalMap = mapInstance.current;
          if (finalMap) {
            const bounds = finalMap.getBounds();
            const finalCenter = finalMap.getCenter();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            onMapChangeRef.current({
              bounds: {
                sw: { lat: sw.getLat(), lng: sw.getLng() },
                ne: { lat: ne.getLat(), lng: ne.getLng() }
              },
              center: { lat: finalCenter.getLat(), lng: finalCenter.getLng() },
              level: finalMap.getLevel(),
            });
          }
        } catch (e) {}
        onComplete?.();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // center prop 변경 또는 isMapReady 변경 시 부드럽게 이동
  // 핵심: isMapReady가 true가 되는 시점에 center가 이미 설정되어 있으면
  // useEffect([center])는 재실행되지 않으므로 [center, isMapReady] 둘 다 의존성에 포함
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !center) return;

    // 지도가 막 초기화된 경우: initMap()에서 mapCache.lastCenter로 지도를 만들었지만
    // center prop이 다른 위치를 가리키면 smoothMoveTo로 이동해야 함
    const currentCenter = mapInstance.current.getCenter();
    const latDiff = Math.abs(currentCenter.getLat() - center.lat);
    const lngDiff = Math.abs(currentCenter.getLng() - center.lng);

    // 좀 더 작은 임계값으로 변경 — 대도시 내 같은 동 안 거리도 부드럽게 이동
    if (latDiff > 0.00001 || lngDiff > 0.00001) {
      // 충분한 거리 차이가 있으면 부드럽게 이동
      smoothMoveTo(center.lat, center.lng, () => {
        window.dispatchEvent(new CustomEvent('map-move-complete', { detail: { lat: center.lat, lng: center.lng } }));
      });
    } else {
      // 이미 목적지에 있으면 즉시 완료 이벤트 발생
      window.dispatchEvent(new CustomEvent('map-move-complete', { detail: { lat: center.lat, lng: center.lng } }));
    }
  }, [center, isMapReady]);

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;

    if (searchOverlayRef.current) {
      searchOverlayRef.current.setMap(null);
      searchOverlayRef.current = null;
    }

    if (searchResultLocation) {
      const content = document.createElement('div');
      content.className = 'search-result-marker-container';
      content.innerHTML = `
        <div class="relative">
          <div class="search-marker-ping"></div>
          <div class="relative w-12 h-12" style="transform: translate(-50%, -100%);">
            <div class="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl"></div>
            <div class="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10"></div>
          </div>
        </div>
      `;
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(searchResultLocation.lat, searchResultLocation.lng),
        content: content,
        zIndex: 11000
      });
      overlay.setMap(mapInstance.current);
      searchOverlayRef.current = overlay;
    }
  }, [searchResultLocation, isMapReady]);

  // ── 마커 겹침 배지 업데이트 ──────────────────────────────────────────
  const updateOverlapBadges = useCallback(() => {
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!map || !kakao?.maps) return;

    const validPostIds = new Set(postsRef.current.map(p => p.id));

    // getBounds() + 컨테이너 크기로 직접 픽셀 좌표 계산
    // pointFromCoords/containerPointFromCoords는 메르카토르 절대 픽셀이라
    // 드래그 후 뷰포트 오프셋 불일치 발생 → getBounds 방식이 항상 정확
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const mapEl = containerRef.current;
    if (!mapEl) return;

    const mapW = mapEl.offsetWidth;
    const mapH = mapEl.offsetHeight;
    const latRange = ne.getLat() - sw.getLat();
    const lngRange = ne.getLng() - sw.getLng();
    if (latRange === 0 || lngRange === 0) return;

    const toPixel = (lat: number, lng: number) => ({
      x: ((lng - sw.getLng()) / lngRange) * mapW,
      y: (1 - (lat - sw.getLat()) / latRange) * mapH,
    });

    const THRESHOLD = 40; // 마커 아이콘이 의미있게 겹치는 거리 (60px 마커 기준)

    type MarkerInfo = { id: string; overlay: any; px: number; py: number };
    const markerInfos: MarkerInfo[] = [];

    overlaysRef.current.forEach((overlay, id) => {
      if (overlay.getMap() === null) return;
      if (!validPostIds.has(id)) return;
      const content = overlay.getContent() as HTMLElement;
      if (content && content.classList.contains('marker-disappear-animation')) return;
      try {
        const pos = overlay.getPosition();
        if (!pos) return;
        const lat = pos.getLat();
        const lng = pos.getLng();
        const { x, y } = toPixel(lat, lng);
        // 화면 밖 마커는 제외 (드래그/줌 직후 음수 좌표 방지)
        if (x < -100 || y < -100 || x > mapW + 100 || y > mapH + 100) return;
        markerInfos.push({ id, overlay, px: x, py: y });
      } catch (e) {}
    });

    // Union-Find 기반 그룹핑
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
      return parent.get(id)!;
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };

    for (const m of markerInfos) parent.set(m.id, m.id);

    for (let i = 0; i < markerInfos.length; i++) {
      for (let j = i + 1; j < markerInfos.length; j++) {
        const a = markerInfos[i];
        const b = markerInfos[j];
        const dx = a.px - b.px;
        const dy = a.py - b.py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= THRESHOLD) {
          union(a.id, b.id);
        }
      }
    }

    // 루트별로 그룹 구성
    const groupMap = new Map<string, MarkerInfo[]>();
    for (const m of markerInfos) {
      const root = find(m.id);
      if (!groupMap.has(root)) groupMap.set(root, []);
      groupMap.get(root)!.push(m);
    }
    const groups = Array.from(groupMap.values());

    // 그룹별 대표 마커: py가 가장 작은(화면 최상단) 마커
    const representativeIds = new Set<string>();

    for (const group of groups) {
      if (group.length < 2) continue;
      const rep = group.reduce((a, b) => (a.py < b.py ? a : b));
      representativeIds.add(rep.id);
    }

    // 배지 DOM 업데이트
    // 배지는 content(최상위 div)의 직접 자식으로 붙임 → innerHTML 교체에 영향 안 받음
    overlaysRef.current.forEach((overlay, id) => {
      if (overlay.getMap() === null) return;
      const content = overlay.getContent() as HTMLElement;
      if (!content) return;
      // 현재 필터에 포함되지 않거나 사라지는 애니메이션 중인 마커는 배지 제거
      if (!validPostIds.has(id) || content.classList.contains('marker-disappear-animation')) {
        const existingBadge = Array.from(content.children).find(
          el => el.classList.contains('overlap-badge')
        ) as HTMLElement | undefined;
        if (existingBadge) existingBadge.remove();
        return;
      }

      // content 직접 자식 중 overlap-badge만 찾음 (querySelector는 하위 전체 탐색이라 제외)
      const existingBadge = Array.from(content.children).find(
        el => el.classList.contains('overlap-badge')
      ) as HTMLElement | undefined;

      const isRep = representativeIds.has(id);
      // markerInfos에서 해당 id가 속한 그룹 찾기 (지도에 표시된 마커만 포함된 groups)
      const group = groups.find(g => g.some(m => m.id === id));
      const count = group ? group.length : 1;

      if (isRep && count >= 2) {
        const countStr = String(count);
        if (existingBadge) {
          if (existingBadge.getAttribute('data-count') !== countStr) {
            existingBadge.setAttribute('data-count', countStr);
            existingBadge.textContent = countStr;
          }
        } else {
          const badge = document.createElement('div');
          badge.className = 'overlap-badge';
          badge.setAttribute('data-count', countStr);
          badge.textContent = countStr;
          badge.style.cssText = [
            'position:absolute',
            'top:-8px',
            'left:50%',
            'transform:translateX(-50%)',
            'min-width:20px',
            'height:20px',
            'padding:0 5px',
            'background:#818cf8',
            'color:#ffffff',
            'font-size:11px',
            'font-weight:800',
            'border-radius:10px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'border:2px solid #ffffff',
            'box-shadow:0 2px 8px rgba(129,140,248,0.45)',
            'z-index:9999',
            'pointer-events:none',
            'letter-spacing:-0.02em',
            'line-height:1',
            'box-sizing:border-box',
            markersHiddenRef.current ? 'opacity:0' : 'opacity:1',
          ].join(';');
          content.style.position = 'relative';
          content.appendChild(badge);
        }
      } else {
        if (existingBadge) existingBadge.remove();
      }
    });
  }, []);

  // ── 겹침 배지 debounce 트리거 ─────────────────────────────────────────
  const scheduleOverlapBadgeUpdate = useCallback(() => {
    if (overlapBadgeTimerRef.current) clearTimeout(overlapBadgeTimerRef.current);
    overlapBadgeTimerRef.current = setTimeout(() => {
      overlapBadgeTimerRef.current = null;
      updateOverlapBadges();
    }, 150);
  }, [updateOverlapBadges]);

  // innerHTML 교체 후 배지 복원을 위한 ref (getMarkerInnerHtml 내부에서 접근)
  const scheduleOverlapBadgeUpdateRef = useRef(scheduleOverlapBadgeUpdate);
  useEffect(() => { scheduleOverlapBadgeUpdateRef.current = scheduleOverlapBadgeUpdate; }, [scheduleOverlapBadgeUpdate]);

  // 지도 이벤트(idle / zoom_changed / dragend)에 연결
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const map = mapInstance.current;

    kakao.maps.event.addListener(map, 'idle', scheduleOverlapBadgeUpdate);
    kakao.maps.event.addListener(map, 'zoom_changed', scheduleOverlapBadgeUpdate);
    kakao.maps.event.addListener(map, 'dragend', scheduleOverlapBadgeUpdate);

    return () => {
      kakao.maps.event.removeListener(map, 'idle', scheduleOverlapBadgeUpdate);
      kakao.maps.event.removeListener(map, 'zoom_changed', scheduleOverlapBadgeUpdate);
      kakao.maps.event.removeListener(map, 'dragend', scheduleOverlapBadgeUpdate);
    };
  }, [isMapReady, scheduleOverlapBadgeUpdate]);

  // posts 변경(마커 추가/제거) 시에도 재계산
  // 마커 제거 애니메이션(520ms) 완료 후 한 번 더 실행하여 카테고리 필터 변경 시 정확한 카운트 반영
  useEffect(() => {
    if (!isMapReady) return;
    scheduleOverlapBadgeUpdate();
    const timer = setTimeout(() => {
      updateOverlapBadges();
    }, 600);
    return () => clearTimeout(timer);
  }, [posts, isMapReady, scheduleOverlapBadgeUpdate, updateOverlapBadges]);

  // ── 비디오 마커 썸네일 비동기 추출 및 마커 img 교체 ──────────
  // ref에 함수를 저장해서 마커 생성 useEffect에서 항상 최신 함수를 참조할 수 있게 함
  extractVideoThumbRef.current = (postId: string, videoUrl: string) => {
    if (videoThumbCacheRef.current.has(postId)) return; // 이미 캐시됨
    if (videoThumbPendingRef.current.has(postId)) return; // 이미 추출 중
    videoThumbPendingRef.current.add(postId);
    console.log('[MapContainer] 비디오 썸네일 추출 시작:', postId);

    const video = document.createElement('video');
    // crossOrigin을 설정하면 Supabase storage에서 CORS preflight가 필요해 실패할 수 있음
    // → 설정하지 않으면 canvas.toDataURL()이 tainted canvas 오류를 낼 수 있지만
    //   같은 origin(supabase.co)이면 문제없음. 외부 URL은 어차피 실패 처리됨.
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.src = '';
      video.load();
    };

    const capture = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); videoThumbPendingRef.current.delete(postId); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        cleanup();
        videoThumbCacheRef.current.set(postId, dataUrl);
        videoThumbPendingRef.current.delete(postId);
        console.log('[MapContainer] 비디오 썸네일 추출 완료, 마커 교체:', postId);

        // 마커 DOM을 썸네일로 즉시 완전 교체
        const overlay = overlaysRef.current.get(postId);
        if (overlay) {
          const content = overlay.getContent() as HTMLElement;
          if (content) {
            // postsRef에서 해당 포스트를 찾아 최신 HTML로 교체 (캐시가 이미 set된 상태)
            const post = postsRef.current.find(p => p.id === postId);
            if (post) {
              const isMineKey = !!(authUserRef.current && String(((post as any).owner_id || (post as any).user_id || '')) === String(authUserRef.current.id));
              const isAdPendingKey = !!(post as any).isAdPending;
              const newStateKey = `${post.borderType}-${post.isAd}-${!!post.isNewRealtime}-${isMineKey}-${isAdPendingKey}-${post.likes}-1`;
              content.innerHTML = getMarkerInnerHtmlRef.current(post, false);
              content.setAttribute('data-content-state', newStateKey);
            }
          }
        }
      } catch {
        cleanup();
        videoThumbPendingRef.current.delete(postId);
      }
    };

    const onMetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0.2) {
        capture();
        return;
      }
      const seekTime = Math.min(Math.max(duration * 0.15, 0.1), duration - 0.1);
      try { video.currentTime = seekTime; } catch { capture(); }
    };

    video.addEventListener('loadedmetadata', onMetadata, { once: true });
    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener('error', () => {
      cleanup();
      videoThumbPendingRef.current.delete(postId);
    }, { once: true });

    // 8초 타임아웃
    setTimeout(() => {
      if (videoThumbPendingRef.current.has(postId)) {
        cleanup();
        videoThumbPendingRef.current.delete(postId);
      }
    }, 8000);

    video.src = videoUrl;
    video.load();
  };

  const getMarkerInnerHtml = (post: any, isViewed: boolean) => {
    const isAd = post.isAd || (post.content && post.content.includes('[AD]'));
    const isAdPending = !!(post as any).isAdPending;
    
    // 광고 대기 중 마커: 반투명 + 시계 아이콘
    if (isAdPending) {
      return `<div class="marker-content-wrapper" style="opacity:0.45;filter:grayscale(0.3);">
        <div class="marker-scaling-target" style="display:flex;flex-direction:column;align-items:center;width:60px;position:relative;">
          <div style="width:100%;background:linear-gradient(90deg,#94a3b8,#cbd5e1,#94a3b8);color:white;font-size:9px;font-weight:900;padding:2px 0 16px 0;border-radius:14px 14px 0 0;text-align:center;box-sizing:border-box;letter-spacing:0.05em;margin-bottom:-16px;position:relative;z-index:1;line-height:1.2;">AD</div>
          <div style="width:60px;height:60px;border-radius:20px;position:relative;z-index:2;border:3px solid #94a3b8;box-shadow:0 4px 12px rgba(0,0,0,0.1);background-color:#f1f5f9;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style="font-size:8px;font-weight:800;color:#94a3b8;letter-spacing:-0.02em;line-height:1;">준비중</span>
            </div>
          </div>
        </div>
      </div>`;
    }

    const currentUser = authUserRef.current;
    const isMine = !!(currentUser && String((post.owner_id || post.user_id || '')) === String(currentUser.id));

    // 광고가 아니고 videoUrl이 있으면 재생 아이콘만 표시

    const hasVideo = !isAd && !!post.videoUrl;

    const isBrokenUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return true;
      if (url.startsWith('blob:')) return true;
      return false;
    };

    const isVideoUrl = (url: string) => {
      if (!url) return false;
      const lower = url.toLowerCase().split('?')[0];
      return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
    };

    const isMockUrl = (url: string) => {
      if (!url) return false;
      return url.includes('pexels.com') || url.includes('unsplash.com') || url.includes('picsum.photos') || url.includes('loremflickr') || url.includes('youtube.com') || url.includes('youtu.be');
    };

    let displayImage = post.image_url || post.image;

    // image_url이 비디오 URL이거나 목업 URL이면 썸네일로 사용 불가
    if (isBrokenUrl(displayImage) || isVideoUrl(displayImage) || isMockUrl(displayImage)) {
      displayImage = '';
    }

    // 비디오 포스트이고 캐시된 썸네일이 있으면 즉시 사용 (깜빡임 방지)
    if (hasVideo && !displayImage) {
      const cached = videoThumbCacheRef.current.get(post.id);
      if (cached) displayImage = cached;
    }

    const optimizedDisplayImage = displayImage
      ? getOptimizedMarkerImage(displayImage, String(post.id))
      : '';

    let borderType = post.borderType || 'none';
    let labelText = ''; let labelBg = ''; let labelColor = 'white';
    if (isAd) { labelText = 'AD'; labelBg = 'ad-rainbow'; }
    else if (borderType === 'popular') { labelText = 'HOT'; labelBg = '#ef4444'; }
    else if (borderType === 'diamond') { labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; }
    else if (borderType === 'gold') { labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; }
    else if (borderType === 'silver') { labelText = 'SILVER'; labelBg = '#94a3b8'; labelColor = 'white'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = (labelText && !isAd) ? `<div style="width: 100%; background: ${labelBg}; color: ${labelColor}; font-size: 9px; font-weight: 900; padding: 2px 0 16px 0; border-radius: 14px 14px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -16px; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.1); line-height: 1.2;">${labelText}</div>` : '';

    const isInfluencer = ['silver', 'gold', 'diamond'].includes(borderType);
    const isPopular = borderType === 'popular';
    let animationClass = '';
    if (isAd) animationClass = '';
    else if (!isMine && (isInfluencer || isPopular)) animationClass = 'animate-marker-float';

    const isSpecialPost = isAd || isInfluencer || isPopular;
    const shineClass = isSpecialPost ? 'shine-overlay' : '';

    let inlineBorderStyle = "border: 3px solid #ffffff;";
    let inlineShadow = "0 6px 16px rgba(0, 0, 0, 0.12)";
    let influencerClass = "";

    if (isMine) {
      inlineBorderStyle = "border: 3px solid #4f46e5;";
      inlineShadow = "0 6px 16px rgba(0, 0, 0, 0.12)";
    }
    else if (isAd) { inlineBorderStyle = "border: 4.5px solid #2563eb;"; inlineShadow = "none"; influencerClass = ""; }
    else if (borderType === 'popular') { inlineBorderStyle = "border: 4.5px solid #ef4444;"; inlineShadow = "0 0 20px rgba(239, 68, 68, 0.5)"; }
    else if (borderType === 'diamond') { inlineBorderStyle = "border: 4.5px solid #22d3ee;"; inlineShadow = "0 0 20px rgba(34, 211, 238, 0.8), inset 0 0 10px rgba(34, 211, 238, 0.5)"; influencerClass = "influencer-glow"; }
    else if (borderType === 'gold') { inlineBorderStyle = "border: 4.5px solid #fbbf24;"; inlineShadow = "0 0 20px rgba(251, 191, 36, 0.6), inset 0 0 10px rgba(251, 191, 36, 0.4)"; influencerClass = "influencer-glow"; }
    else if (borderType === 'silver') { inlineBorderStyle = "border: 4.5px solid #94a3b8;"; inlineShadow = "0 0 16px rgba(148, 163, 184, 0.7), inset 0 0 8px rgba(148, 163, 184, 0.3)"; influencerClass = "influencer-glow"; }

    const adStyleTag = isAd ? `<style>
      @keyframes _ad_flip { 0%,75%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
      @keyframes _tornado_outer { 0%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(90deg) scale(1.15)} 50%{transform:rotate(180deg) scale(1)} 75%{transform:rotate(270deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
      @keyframes _tornado_inner { 0%{transform:rotate(0deg) scale(1.2)} 100%{transform:rotate(-360deg) scale(1.2)} }
      ._ad_lbl { position:relative; overflow:hidden; width:100%; color:white; font-size:9px; font-weight:900; padding:2px 0 16px 0; border-radius:14px 14px 0 0; text-align:center; box-sizing:border-box; letter-spacing:0.05em; margin-bottom:-16px; z-index:1; line-height:1.2; }
      ._ad_lbl::before { content:""; position:absolute; inset:-60%; border-radius:50%; background:conic-gradient(from 0deg,#1d4ed8 0deg,#3b82f6 60deg,#60a5fa 90deg,#93c5fd 120deg,#2563eb 180deg,#1e40af 240deg,#3b82f6 300deg,#1d4ed8 360deg); animation:_tornado_outer 1.2s linear infinite; z-index:0; }
      ._ad_lbl::after { content:""; position:absolute; inset:-40%; border-radius:50%; background:conic-gradient(from 0deg,rgba(99,102,241,0.9) 0deg,rgba(59,130,246,0.7) 90deg,rgba(147,197,253,0.5) 150deg,rgba(37,99,235,0.9) 210deg,rgba(99,102,241,0.7) 270deg,rgba(59,130,246,0.9) 330deg,rgba(99,102,241,0.9) 360deg); animation:_tornado_inner 0.8s linear infinite; z-index:1; }
      ._ad_lbl_txt { position:relative; z-index:2; text-shadow:0 1px 3px rgba(0,0,0,0.5); }
    </style>` : '';

    const adLabelHtml = isAd
      ? `<div class="_ad_lbl"><span class="_ad_lbl_txt">AD</span></div>`
      : '';

    const adSparklesHtml = '';

    const adGlowLayer = '';

    const innerBoxStyle = `width:60px;height:60px;border-radius:20px;position:relative;z-index:2;${inlineBorderStyle}box-shadow:${inlineShadow};background-color:#e5e7eb;box-sizing:border-box;overflow:hidden;`;

    // ── 24시간 카운트다운 형광 그린 링 ────────────────────────────────
    // 광고/광고대기 마커에는 표시하지 않음. createdAt이 없는 포스트도 skip.
    // path는 12시 방향에서 시작해 시계 반대방향으로 한 바퀴 도는 둥근 사각형.
    // stroke-dashoffset을 음수로 둘수록 path의 시작점부터 stroke가 깎여나가
    // → 남아있는 끝점이 시계 반대방향으로 회전하면서 줄어드는 효과.
    const createdAtMs = getPostCreatedAtMs(post);
    const showCountdownRing = isMarkerExpirable(post) && createdAtMs !== null;
    const countdownRingHtml = showCountdownRing
      ? (() => {
          const elapsed = Math.min(Math.max(Date.now() - (createdAtMs as number), 0), MARKER_LIFESPAN_MS);
          const remainingRatio = 1 - elapsed / MARKER_LIFESPAN_MS;
          // 남은 비율 * 둘레 = 보여줄 stroke 길이
          // dashoffset을 음수로 두면 시작점(12시 상단 중앙)에서부터 깎이고,
          // path가 시계 반대방향으로 그려지므로 끝점이 반시계 방향으로 후퇴한다.
          const dashOffset = -(COUNTDOWN_RING_PERIMETER * (1 - remainingRatio));
          return `<svg class="marker-countdown-ring" data-created-at="${createdAtMs}" viewBox="0 0 ${COUNTDOWN_RING_BOX} ${COUNTDOWN_RING_BOX}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:12;overflow:visible;">
            <path class="marker-countdown-ring-track" d="${COUNTDOWN_RING_PATH}" fill="none" stroke="${COUNTDOWN_TRACK_COLOR}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            <path class="marker-countdown-ring-progress" d="${COUNTDOWN_RING_PATH}" fill="none" stroke="${COUNTDOWN_PROGRESS_COLOR}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${COUNTDOWN_RING_PERIMETER.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" style="filter:drop-shadow(${COUNTDOWN_GLOW});" />
          </svg>`;
        })()
      : '';

    // AD 마커: 라벨+이미지 박스를 하나의 wrapper로 감싸서 함께 회전
    const adFlipWrapperStart = isAd
      ? `<div style="display:flex;flex-direction:column;align-items:center;width:60px;animation:_ad_flip 4s ease-in-out infinite;transform-style:preserve-3d;">`
      : '';
    const adFlipWrapperEnd = isAd ? `</div>` : '';

    // 이미지가 없는 비디오 마커: 썸네일 추출 중 로딩 상태 표시
    const imgContent = optimizedDisplayImage
      ? `<img src="${optimizedDisplayImage}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : (hasVideo
        ? `<div style="width:100%;height:100%;background:#1e1b4b;display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='#a5b4fc'><polygon points='5 3 19 12 5 21 5 3'/></svg></div>`
        : `<img src="${FALLBACK_IMAGE}" style="width:100%;height:100%;object-fit:cover;display:block;" />`);

    return `${adStyleTag}<div class="marker-content-wrapper">
      <div class="${animationClass} marker-scaling-target" style="display:flex;flex-direction:column;align-items:center;width:60px;position:relative;">
        ${isAd ? adGlowLayer : ''}
        ${isAd ? adFlipWrapperStart : ''}
        ${isAd ? adLabelHtml : labelHtml}
        <div class="${influencerClass}" style="${innerBoxStyle}">
          ${isAd ? adSparklesHtml : ''}
          <div style="width:100%;height:100%;position:relative;border-radius:${isAd ? '15px' : '16px'};overflow:hidden;" class="${shineClass}">
            ${imgContent}
            <div style="position:absolute;bottom:3px;right:3px;background:#fef2f2;border:1px solid #fecaca;color:#ef4444;font-size:9px;font-weight:900;padding:2px 5px 2px 4px;border-radius:8px;z-index:5;line-height:1;display:flex;align-items:center;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
              <span>${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}</span>
            </div>
            ${videoIconHtml}
            ${countdownRingHtml}
          </div>
        </div>
        ${isAd ? adFlipWrapperEnd : ''}
      </div>
    </div>`;
  };

  getMarkerInnerHtmlRef.current = getMarkerInnerHtml;

  // ── 24시간 만료 마커 제거 + 카운트다운 링 dashoffset 갱신 ──────────
  // 1분마다 실행:
  //   1) 모든 마커 SVG의 dashoffset을 현재 경과 시간에 맞춰 갱신
  //   2) 24h 지난 마커는 disappear 애니메이션 후 setMap(null)
  useEffect(() => {
    if (!isMapReady) return;

    const tick = () => {
      const now = Date.now();

      overlaysRef.current.forEach((overlay, id) => {
        const content = overlay.getContent() as HTMLElement | null;
        if (!content) return;
        // 이미 사라지는 애니메이션 진행 중이면 skip
        if (content.classList.contains('marker-disappear-animation')) return;

        const ring = content.querySelector('.marker-countdown-ring') as SVGElement | null;
        if (!ring) return;
        const createdAtAttr = ring.getAttribute('data-created-at');
        if (!createdAtAttr) return;
        const createdMs = Number(createdAtAttr);
        if (!Number.isFinite(createdMs)) return;

        const elapsed = now - createdMs;

        if (elapsed >= MARKER_LIFESPAN_MS) {
          // 24시간 만료 → disappear 애니메이션 후 제거
          content.classList.remove('marker-appear-animation');
          content.classList.add('marker-disappear-animation');
          content.style.pointerEvents = 'none';
          const removalTimer = window.setTimeout(() => {
            removalTimeoutsRef.current.delete(id);
            const currentOverlay = overlaysRef.current.get(id);
            if (currentOverlay) {
              currentOverlay.setMap(null);
              overlaysRef.current.delete(id);
              viewportVisibilityRef.current.delete(String(id));
              clearViewportAnimationTimer(String(id));
            }
          }, 520);
          removalTimeoutsRef.current.set(id, removalTimer);
          return;
        }

        // 아직 만료 전 → 진행 path의 dashoffset만 갱신 (트랙은 정적이므로 그대로)
        const remainingRatio = 1 - elapsed / MARKER_LIFESPAN_MS;
        const dashOffset = -(COUNTDOWN_RING_PERIMETER * (1 - remainingRatio));
        const progressPath = ring.querySelector('.marker-countdown-ring-progress');
        if (progressPath) {
          progressPath.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));
        }
      });
    };

    // 마운트 직후 한 번 즉시 실행 (마커가 이미 그려져 있는 상태에서 첫 정확한 값 반영)
    tick();
    const intervalId = window.setInterval(tick, MARKER_EXPIRY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isMapReady, clearViewportAnimationTimer]);

  // CSS 애니메이션 duration을 변수로 전달
  const circleCircumference = 2 * Math.PI * 13; // r=13


  return (
    <div
      className="w-full h-full relative select-none touch-none overflow-hidden"
      style={{
        backgroundColor: '#f8f9fa',
        WebkitUserSelect: 'none',
        KhtmlUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        ...({ WebkitUserDrag: 'none' } as any)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes user-loc-pulse {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.8; }
          70%  { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
        @keyframes user-loc-accuracy {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.5; }
          60%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0.1; }
          100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
        }
      `}</style>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      )}
      {mapLoadError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/90 px-6 text-center backdrop-blur-sm">
          <div className="max-w-xs rounded-3xl border border-indigo-100 bg-white p-5 shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <RefreshCw className="h-5 w-5" />
            </div>
            <p className="text-sm font-extrabold text-slate-900">지도를 불러올 수 없어요</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{mapLoadError}</p>
            <button
              type="button"
              className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-lg shadow-indigo-200 active:scale-95"
              onClick={() => {
                setMapLoadError(null);
                setIsLoading(true);
                loadKakaoMapsSdk()
                  .then(() => {
                    const isInit = initMap();
                    if (!isInit) throw new Error('Map container is not ready');
                  })
                  .catch(() => {
                    setIsLoading(false);
                    setMapLoadError('다시 시도해도 지도를 불러오지 못했습니다. 잠시 후 재시도해주세요.');
                  });
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 롱프레스 진행 표시 — 상단 OffScreenMarkerIndicator(52px) 아래에 위치 */}
      {uiState === 'pressing' && (
        <div
          className="longpress-toast"
          style={{
            position: 'fixed',
            top: toastTopOffset !== undefined
              ? `${toastTopOffset + 64}px`
              : 'calc(env(safe-area-inset-top, 0px) + 192px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            padding: '10px 18px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
            <circle
              cx="16" cy="16" r="13"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circleCircumference}
              strokeDashoffset={circleCircumference}
              style={{ animation: `longpress-circle ${LONG_PRESS_DURATION - 500}ms linear forwards` }}
            />
          </svg>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
            지도 보기
          </span>
        </div>
      )}

      {/* 히트맵 범례는 Index.tsx의 TrendingPosts 패널 아래로 이동됨 */}

      {/* 마커 숨김 상태 안내 — 상단 OffScreenMarkerIndicator(52px) 아래에 위치 */}
      {uiState === 'hidden' && (
        <div
          style={{
            position: 'fixed',
            top: toastTopOffset !== undefined
              ? `${toastTopOffset + 64}px`
              : 'calc(env(safe-area-inset-top, 0px) + 192px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            padding: '10px 18px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            animation: 'longpress-toast-in 0.25s ease forwards',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)',
            animation: 'longpress-dot-pulse 1.2s ease-in-out infinite',
          }} />
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
            손을 떼면 마커가 다시 나타납니다
          </span>
        </div>
      )}

      {/* 히트맵 오버레이 */}
      <HeatmapOverlay
        points={heatmapPoints}
        mapInstance={mapInstanceState}
        visible={level >= 7}
      />
      <div
        ref={containerRef}
        id="kakao-map"
        className="w-full h-full select-none"
        style={{ position: 'relative' }}
      ></div>
      {/* 현재 위치 마커: 카카오맵 div 뒤에 DOM 배치 + 높은 zIndex로 항상 최상단 표시 */}
      {userLocation && userLocationPixel && !hideUserLocation && (
        <div
          style={{
            position: 'absolute',
            left: userLocationPixel.x,
            top: userLocationPixel.y,
            transform: 'translate(-50%, -50%)',
            zIndex: 9000,
            pointerEvents: 'none',
            width: 22,
            height: 22,
          }}
        >
          {/* 정확도 파동 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(66, 133, 244, 0.15)',
            animation: 'user-loc-accuracy 2.4s ease-out infinite',
          }} />
          {/* 파동 링 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 22, borderRadius: '50%',
            background: 'transparent',
            border: '2.5px solid rgba(66, 133, 244, 0.6)',
            animation: 'user-loc-pulse 2.4s ease-out infinite',
          }} />
          {/* 흰 테두리 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 22, borderRadius: '50%',
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }} />
          {/* 파란 점 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: '#4285F4',
          }} />
        </div>
      )}
    </div>
  );
};

export default React.memo(MapContainer);