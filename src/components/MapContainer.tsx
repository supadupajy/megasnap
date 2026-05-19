"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, RefreshCw } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';
import { loadKakaoMapsSdk } from '@/utils/kakao-maps';
import { getFallbackImage, getOptimizedMarkerImage, PLACEHOLDER_IMAGE } from '@/lib/utils';
import { isGeneratedVideoThumbnailUrl } from '@/utils/post-media';
import HeatmapOverlay from '@/components/HeatmapOverlay';

interface MapContainerProps {
  posts: any[];
  /**
   * 24시간이 지나 활성 마커에선 사라졌지만 DB엔 남아있는 포스트들.
   * 회색 작은 점("고스트 마커")으로 표시한다.
   * 부모에서 viewport 안의 최신순 N개만 fetch해서 전달.
   */
  ghostPosts?: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  onVisibleMarkerIdsChange?: (ids: string[]) => void;
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

const isBrokenMarkerImageUrl = (url: unknown) => {
  if (typeof url !== 'string') return true;
  if (!url || url === 'null' || url === 'undefined') return true;
  if (url.startsWith('blob:')) return true;
  return false;
};

const isMarkerVideoUrl = (url: unknown) => {
  if (typeof url !== 'string' || !url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
};

const isMockMarkerImageUrl = (url: unknown) => {
  if (typeof url !== 'string' || !url) return false;
  return url.includes('pexels.com') || url.includes('unsplash.com') || url.includes('picsum.photos') || url.includes('loremflickr') || url.includes('youtube.com') || url.includes('youtu.be');
};

const isPlaceholderMarkerImageUrl = (url: unknown) => {
  if (typeof url !== 'string') return false;
  return url === PLACEHOLDER_IMAGE || url.endsWith('/placeholder.svg');
};

const getStoredMarkerThumbnail = (post: any) => {
  // 영상 포스트의 경우, 서버측에서 자동 생성된 `-thumb.jpg`(예: opening-thumb.jpg)도
  // 신뢰할 수 있는 썸네일로 허용한다. 이렇게 해야 DB에 이미 저장된 썸네일이 즉시
  // 표시되어, 클라이언트 비동기 video 프레임 추출이 실패하더라도 빈 회색 버블이
  // 노출되지 않는다.
  const hasVideo = !!(
    (typeof post?.videoUrl === 'string' && post.videoUrl.trim()) ||
    (typeof post?.video_url === 'string' && post.video_url.trim()) ||
    (Array.isArray(post?.videoUrls) && post.videoUrls.some((u: unknown) => typeof u === 'string' && (u as string).trim())) ||
    (Array.isArray(post?.video_urls) && post.video_urls.some((u: unknown) => typeof u === 'string' && (u as string).trim()))
  );

  const primary = post?.image_url || post?.image;
  if (
    !isBrokenMarkerImageUrl(primary) &&
    !isPlaceholderMarkerImageUrl(primary) &&
    !isMarkerVideoUrl(primary) &&
    !isMockMarkerImageUrl(primary) &&
    (hasVideo || !isGeneratedVideoThumbnailUrl(primary))
  ) {
    return primary;
  }

  if (!Array.isArray(post?.images)) return '';
  return post.images.find((url: unknown) => (
    !isBrokenMarkerImageUrl(url) &&
    !isPlaceholderMarkerImageUrl(url) &&
    !isMarkerVideoUrl(url) &&
    !isMockMarkerImageUrl(url) &&
    (hasVideo || !isGeneratedVideoThumbnailUrl(typeof url === 'string' ? url : undefined))
  )) || '';
};

const LONG_PRESS_DURATION = 1000; // 1초
const LONG_PRESS_MOVE_THRESHOLD = 5; // px 이상 움직이면 취소 (드래그 감지를 빠르게)

// ── 마커 24시간 만료 관련 상수 ────────────────────────────────────────
const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000; // 24시간
const MARKER_EXPIRY_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 만료/타이머 갱신

// ── 고스트(만료) 마커 관련 상수 ────────────────────────────────────────
// 24시간이 지나 활성 마커에서 사라진 포스트들을 회색 잔상으로 표시.
// DB에 수천개가 있어도 한 화면에는 아래 개수까지만 그려서 부하를 최소화한다.
const GHOST_MARKER_MAX_VISIBLE = 30;

// 카운트다운 링 원형 테두리 파라미터 (60×60 버블 마커 안쪽)
const COUNTDOWN_RING_PADDING = 2;
const COUNTDOWN_RING_BOX = 60;
const COUNTDOWN_RING_RADIUS = COUNTDOWN_RING_BOX / 2 - COUNTDOWN_RING_PADDING;
const COUNTDOWN_RING_CENTER = COUNTDOWN_RING_BOX / 2;

// 카운트다운 링 컬러 (LocationButtonWithTimer와 통일)
// 남은 시간: 형광 네온 그린 / 지난 시간: 진한 초록 (opacity ↑)
const COUNTDOWN_PROGRESS_COLOR = '#39FF14';            // 형광 네온 그린 — 남은 시간
const COUNTDOWN_TRACK_COLOR = 'rgba(34,197,94,0.55)';  // 진한 초록(opacity 0.55) — 지난 시간
const COUNTDOWN_GLOW = '0 0 4px rgba(57,255,20,0.7)';  // 네온 발광

/** 12시 방향에서 시작해 시계 반대방향으로 도는 원형 SVG path */
const buildCountdownRingPath = (): string => {
  const cx = COUNTDOWN_RING_CENTER;
  const cy = COUNTDOWN_RING_CENTER;
  const r = COUNTDOWN_RING_RADIUS;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r}`;
};

const COUNTDOWN_RING_PERIMETER = 2 * Math.PI * COUNTDOWN_RING_RADIUS;

const COUNTDOWN_RING_PATH = buildCountdownRingPath();

const getCountdownRingSparkPoint = (progressRatio: number): { x: number; y: number } => {
  const angle = -Math.PI / 2 - 2 * Math.PI * progressRatio;
  return {
    x: COUNTDOWN_RING_CENTER + COUNTDOWN_RING_RADIUS * Math.cos(angle),
    y: COUNTDOWN_RING_CENTER + COUNTDOWN_RING_RADIUS * Math.sin(angle),
  };
};

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
  ghostPosts,
  viewedPostIds,
  onMarkerClick,
  onMapChange,
  onMapClick,
  onVisibleMarkerIdsChange,
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
  const [markerExpiryNow, setMarkerExpiryNow] = useState(() => Date.now());
  const [videoThumbRevision, setVideoThumbRevision] = useState(0);

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
  // 고스트(만료) 마커 전용 오버레이 맵 - 활성 마커와 분리 관리
  const ghostOverlaysRef = useRef<Map<string, any>>(new Map());
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
  const lastStableMapViewRef = useRef<{ center: { lat: number; lng: number }; level: number } | null>(null);
  const postsRef = useRef<any[]>(posts);
  const viewedPostIdsRef = useRef<Set<any>>(viewedPostIds);
  const internalViewedIdsRef = useRef<Set<string>>(new Set());
  const overlapBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportVisibilityRef = useRef<Map<string, boolean>>(new Map());
  const viewportAnimationFrameRef = useRef<number | null>(null);
  const viewportAnimationTimersRef = useRef<Map<string, number>>(new Map());
  const markerFloatTimersRef = useRef<Map<string, number>>(new Map());
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

  const isMapContainerVisible = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && container.offsetWidth > 0 && container.offsetHeight > 0;
  }, []);

  const clearMarkerFloatTimer = useCallback((id: string) => {
    const timerId = markerFloatTimersRef.current.get(id);
    if (timerId) window.clearTimeout(timerId);
    markerFloatTimersRef.current.delete(id);
  }, []);

  // 마커 둥실 애니메이션 스케줄러.
  //
  // 주의: 이 함수는 마커가 생성될 때마다 호출되고, innerHTML 교체 시에도 다시 호출된다.
  // 따라서 다음 사이클을 안전하게 이어가려면:
  //   1) 다음 사이클 예약은 overlay 자체(=id)에 묶어 두고, 매번 querySelector로 최신 target을 찾는다.
  //   2) target이 detached/없음이면 그냥 return하지 말고, 같은 사이클 주기로 재예약한다 (그래야 끊기지 않는다).
  //   3) viewport 밖/숨김 상태일 때도 사이클은 계속 이어가되 클래스는 토글하지 않는다.
  const scheduleMarkerFloat = useCallback((id: string, _content: HTMLElement) => {
    // 이미 사이클이 도는 중이면 중복 예약하지 않는다. (innerHTML 교체 후 재호출 등에서도
    // 기존 사이클을 그대로 유지해야 둥실 애니메이션이 끊기지 않는다.)
    if (markerFloatTimersRef.current.has(id)) return;

    const runStart = (delay: number) => {
      const startTimerId = window.setTimeout(() => {
        // 시작 타이머 실행 직후, 같은 slot은 곧이어 종료 타이머로 덮어쓰여진다.
        const latestOverlay = overlaysRef.current.get(id);
        const latestContent = latestOverlay?.getContent?.() as HTMLElement | null;

        if (!latestOverlay || !latestContent) {
          // overlay 자체가 사라졌으면 더 이상 사이클을 이어가지 않는다.
          markerFloatTimersRef.current.delete(id);
          return;
        }

        const target = latestContent.querySelector('.animate-marker-float') as HTMLElement | null;
        const skipThisCycle =
          !target ||
          !target.isConnected ||
          latestContent.classList.contains('marker-viewport-hidden') ||
          latestContent.classList.contains('markers-hidden') ||
          latestContent.classList.contains('marker-disappear-animation');

        if (skipThisCycle) {
          // target이 일시적으로 없거나 가려진 상태면 이번 사이클은 건너뛰고 짧게 재시도 →
          // 그래야 다음 사이클이 영구히 끊기지 않는다.
          runStart(3000 + Math.random() * 2000);
          return;
        }

        target.classList.remove('marker-float-active');
        // reflow 강제로 애니메이션 재시작
        void target.offsetWidth;
        target.classList.add('marker-float-active');

        const endTimerId = window.setTimeout(() => {
          // 종료 시 target을 다시 조회 (그동안 innerHTML이 교체됐을 수 있음)
          const overlayNow = overlaysRef.current.get(id);
          const contentNow = overlayNow?.getContent?.() as HTMLElement | null;
          const targetNow = contentNow?.querySelector('.animate-marker-float') as HTMLElement | null;
          if (targetNow && targetNow.isConnected) {
            targetNow.classList.remove('marker-float-active');
          }
          // 다음 사이클 예약
          runStart(8000 + Math.random() * 2000);
        }, 3000);
        markerFloatTimersRef.current.set(id, endTimerId);
      }, delay);
      markerFloatTimersRef.current.set(id, startTimerId);
    };

    runStart(Math.random() * 2000);
  }, []);

  useEffect(() => {
    return () => {
      markerFloatTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      markerFloatTimersRef.current.clear();
    };
  }, []);

  const rememberStableMapView = useCallback((map: any) => {
    try {
      if (!isMapContainerVisible()) return;
      const center = map.getCenter();
      lastStableMapViewRef.current = {
        center: { lat: center.getLat(), lng: center.getLng() },
        level: map.getLevel(),
      };
    } catch {}
  }, [isMapContainerVisible]);

  // 히트맵도 실제 지도 마커와 동일한 24시간 만료 룰을 적용한다.
  // 즉, DB에 남아 있어도 현재 지도에 표시되지 않는 만료 마커는 히트맵에서 제외한다.
  const heatmapPoints = useMemo(() => {
    return posts
      .filter(p => p.lat != null && p.lng != null && !isMarkerExpired(p, markerExpiryNow))
      .map(p => ({ lat: p.lat as number, lng: p.lng as number }));
  }, [posts, markerExpiryNow]);

  // 고스트(만료) 후보: 부모(Index.tsx)가 viewport 안의 만료 포스트를 별도 fetch해서
  // ghostPosts prop으로 넘겨준다. 여기서는 좌표 유효성만 다시 한 번 거른다.
  // 최신순(생성일 내림차순)으로 정렬해 viewport 진입 시 가장 최근 것부터 표시.
  const ghostCandidates = useMemo(() => {
    const list = ghostPosts ?? [];
    return list
      .filter(p => p && p.lat != null && p.lng != null)
      .map(p => ({
        post: p,
        createdMs: getPostCreatedAtMs(p) ?? 0,
      }))
      .sort((a, b) => b.createdMs - a.createdMs);
  }, [ghostPosts]);

  const ghostCandidatesRef = useRef(ghostCandidates);
  useEffect(() => { ghostCandidatesRef.current = ghostCandidates; }, [ghostCandidates]);

  // draggable prop 변경 시 카카오맵 드래그 활성/비활성
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    mapInstance.current.setDraggable(draggable);
  }, [draggable, isMapReady]);

  // 숨겨져 있던 지도(display:none)가 다시 보일 때 카카오맵 타일이 일부만 로드되는 현상 방지.
  // relayout을 한 번만 호출하면 Android WebView에서 타이밍에 따라 실패할 수 있어 짧게 재시도한다.
  useEffect(() => {
    const runRelayout = () => {
      const kakao = (window as any).kakao;
      const map = mapInstance.current;
      const container = containerRef.current;
      if (!map || !kakao?.maps?.LatLng || !container || container.offsetWidth === 0 || container.offsetHeight === 0) return;

      try {
        const stableView = lastStableMapViewRef.current;
        const currentCenter = map.getCenter();
        const lat = stableView?.center.lat ?? currentCenter.getLat();
        const lng = stableView?.center.lng ?? currentCenter.getLng();
        const targetLevel = stableView?.level ?? map.getLevel();
        map.relayout();
        map.setLevel(targetLevel, { animate: false });
        map.setCenter(new kakao.maps.LatLng(lat, lng));
      } catch (e) {}
    };

    const requestRelayout = () => {
      requestAnimationFrame(runRelayout);
      window.setTimeout(runRelayout, 80);
      window.setTimeout(runRelayout, 250);
      window.setTimeout(runRelayout, 700);
    };

    const handleRelayout = () => {
      requestRelayout();
    };
    window.addEventListener('map-relayout-request', handleRelayout);

    const container = containerRef.current;
    const observer = container ? new ResizeObserver(() => requestRelayout()) : null;
    if (container && observer) observer.observe(container);

    return () => {
      window.removeEventListener('map-relayout-request', handleRelayout);
      observer?.disconnect();
    };
  }, []);

  const { user: authUser } = useAuth();

  const onMapChangeRef = useRef(onMapChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  const onVisibleMarkerIdsChangeRef = useRef(onVisibleMarkerIdsChange);
  const getMarkerInnerHtmlRef = useRef<(post: any, isViewed: boolean) => string>(() => '' );
  const authUserRef = useRef(authUser);

  useEffect(() => { onMapChangeRef.current = onMapChange; }, [onMapChange]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onVisibleMarkerIdsChangeRef.current = onVisibleMarkerIdsChange; }, [onVisibleMarkerIdsChange]);
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

  // viewport 안팎으로 들어오고 나가는 마커도 화면 안으로 들어올 때는
  // opacity 페이드가 아니라 팝 등장 애니메이션을 재생한다.
  const applyMarkerViewportState = useCallback((id: string, overlay: any, isVisible: boolean, _animate = true) => {
    const content = overlay.getContent() as HTMLElement | null;
    if (!content || content.classList.contains('marker-disappear-animation')) return;

    const wasVisible = viewportVisibilityRef.current.get(id);
    if (wasVisible === isVisible) return;

    viewportVisibilityRef.current.set(id, isVisible);
    clearViewportAnimationTimer(id);
    // 혹시 남아있을 수 있는 과거 진입/이탈 keyframe 클래스를 정리
    content.classList.remove('marker-viewport-appearing', 'marker-viewport-disappearing');

    if (isVisible) {
      content.classList.remove('marker-viewport-hidden', 'markers-hidden', 'markers-revealing');
      content.classList.remove('marker-appear-animation');
      void content.offsetWidth;
      content.classList.add('marker-appear-animation');
    } else {
      content.classList.remove('marker-appear-animation');
      content.classList.add('marker-viewport-hidden');
    }
  }, [clearViewportAnimationTimer]);

  const updateMarkerViewportVisibility = useCallback((animate = true) => {
    if (!mapInstance.current || currentLevelRef.current >= 7) {
      onVisibleMarkerIdsChangeRef.current?.([]);
      return;
    }
    // 드래그 중에는 평가/애니메이션을 보류 (dragend에서 한 번에 처리)
    if (isDraggingViewportRef.current) return;

    const visibleIds: string[] = [];
    overlaysRef.current.forEach((overlay, id) => {
      const isVisible = isOverlayInsideViewport(overlay);
      applyMarkerViewportState(String(id), overlay, isVisible, animate);
      const content = overlay.getContent() as HTMLElement | null;
      if (isVisible && overlay.getMap?.() !== null && !content?.classList.contains('marker-disappear-animation')) {
        visibleIds.push(String(id));
      }
    });
    onVisibleMarkerIdsChangeRef.current?.(visibleIds);
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
    // 고스트 마커도 함께 숨김
    ghostOverlaysRef.current.forEach((overlay) => {
      const content = overlay.getContent() as HTMLElement;
      if (content) {
        content.classList.remove('markers-revealing');
        content.classList.add('markers-hidden');
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
        content.classList.remove('markers-hidden', 'markers-revealing', 'marker-viewport-hidden');
        content.classList.remove('marker-appear-animation');
        void content.offsetWidth;
        content.classList.add('marker-appear-animation');
        // 배지 복원
        const badge = content.querySelector('.overlap-badge') as HTMLElement | null;
        if (badge) badge.style.opacity = '1';
      }
    });
    // 고스트 마커도 함께 복원
    ghostOverlaysRef.current.forEach((overlay) => {
      const content = overlay.getContent() as HTMLElement;
      if (content) {
        content.classList.remove('markers-hidden', 'markers-revealing');
        content.classList.remove('ghost-marker-appear-animation');
        void content.offsetWidth;
        content.classList.add('ghost-marker-appear-animation');
      }
    });
    if (searchOverlayRef.current) {
      const c = searchOverlayRef.current.getContent() as HTMLElement;
      if (c) { c.style.transition = 'none'; c.style.opacity = '1'; }
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
              clearMarkerFloatTimer(String(postId));
            }
          }, 520);
        }
      } catch (err) {
        console.error('[MapContainer] Delete animation error:', err);
      }
    };
    window.addEventListener('animate-marker-delete', handleAnimateDelete);
    return () => window.removeEventListener('animate-marker-delete', handleAnimateDelete);
  }, [clearViewportAnimationTimer, clearMarkerFloatTimer]);

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
      lastStableMapViewRef.current = { center: initialCenter, level: initialLevel };

      const updateZoomClass = () => {
        const lvl = map.getLevel();
        const el = containerRef.current;

        if (!el) return;
        el.className = el.className.replace(/\bzoom-\d+\b/g, '');
        el.classList.add(`zoom-${lvl}`);
      };

      const updateMapData = (forceInitial = false) => {
        // 숨겨진 지도(display:none/0x0)에서 Kakao Map이 viewport 변화에 반응하면
        // center/bounds가 한 점으로 무너지는 경우가 있다. 이 상태의 이벤트는 앱 상태에 절대 반영하지 않는다.
        if (!isMapContainerVisible()) return;
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
          if (sw.getLat() === ne.getLat() && sw.getLng() === ne.getLng()) return;
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
          const centerData = { lat: currentCenter.getLat(), lng: currentCenter.getLng() };

          lastStableMapViewRef.current = { center: centerData, level: mapLevel };
          localStorage.setItem('map_bounds', JSON.stringify(boundsData));
          onMapChangeRef.current({
            bounds: boundsData,
            center: centerData,
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

      kakao.maps.event.addListener(map, 'idle', () => {
        updateMapData();
      });
      kakao.maps.event.addListener(map, 'center_changed', () => {
        if (isMapContainerVisible()) rememberStableMapView(map);
      });

      // zoom_changed: 레벨 즉시 전달 (idle보다 먼저 발생하므로 레벨 7 전환 시 마커 깜빡임 방지)
      // 단, onMapChangeRef는 여기서만 호출 (별도 useEffect의 zoom_changed 리스너와 중복 방지)
      kakao.maps.event.addListener(map, 'zoom_changed', () => {
        updateMapData();
      });
      
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
              clearMarkerFloatTimer(String(id));
            }
          }, 520);
          removalTimeoutsRef.current.set(id, removalTimer);
        } else if (!content) {
          overlay.setMap(null);
          overlaysRef.current.delete(id);
          viewportVisibilityRef.current.delete(String(id));
          clearViewportAnimationTimer(String(id));
          clearMarkerFloatTimer(String(id));
        }
      }
    });

    const nowForExpiry = Date.now();
    posts.forEach(post => {
      if (!post || post.lat == null || post.lng == null) return;
      // 24시간 지난 일반 포스트(광고 제외)는 마커를 만들지 않음
      if (isMarkerExpired(post, nowForExpiry)) return;
      const position = new kakao.maps.LatLng(post.lat, post.lng);

      const isViewed = combinedViewedIds.has(post.id);
      const isNew = !!post.isNewRealtime;
      const existingOverlay = overlaysRef.current.get(post.id);
      const isMineKey = !!(authUser && String(((post as any).owner_id || (post as any).user_id || '')) === String(authUser.id));
      const isAdPendingKey = !!(post as any).isAdPending;
      const firstVideoUrl = !post.isAd
        ? (post.videoUrl || (Array.isArray(post.videoUrls) ? post.videoUrls.find((url) => typeof url === 'string' && url.trim()) : ''))
        : '';
      const storedVideoPoster = firstVideoUrl ? getStoredMarkerThumbnail(post) : '';
      const cachedVideoThumb = firstVideoUrl ? videoThumbCacheRef.current.get(post.id) : '';
      // 비디오 썸네일 캐시 여부를 key에 포함 → 썸네일 추출 완료 시 마커 갱신 트리거
      const hasThumbKey = firstVideoUrl ? (cachedVideoThumb ? '1' : '0') : '';
      const markerFloatKey = 'float-v5';
      // 영상 포스트가 서버측 -thumb.jpg 폴백을 쓰는지 여부도 키에 반영 →
      // 기존 마커가 빈 상태로 캐시되어 있어도 데이터 흐름이 바뀌면 강제로 재생성된다.
      const storedThumbKey = firstVideoUrl ? (storedVideoPoster ? 's1' : 's0') : '';
      const contentStateKey = `${post.borderType}-${post.isAd}-${isNew}-${isMineKey}-${isAdPendingKey}-${post.likes}-${hasThumbKey}-${storedThumbKey}-${markerFloatKey}`;
      const positionStateKey = `${post.lat},${post.lng}`;

      // 영상 포스트라도 마커는 즉시 생성한다.
      // 썸네일이 없으면 어두운 배경 + 플레이 아이콘만 먼저 보이고,
      // 비동기로 추출/저장된 썸네일이 들어오면 img.src를 갱신한다.
      if (firstVideoUrl && !storedVideoPoster && !cachedVideoThumb) {
        extractVideoThumbRef.current(post.id, firstVideoUrl);
      }

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
        content.setAttribute('data-position-state', positionStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        scheduleMarkerFloat(String(post.id), content);
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

        // 저장된 썸네일이 없는 오래된 영상 포스트만 비동기로 추출한다.
        // 이미 업로드 시 생성된 썸네일이 있으면 마커를 다시 그리지 않아 검은 프레임 → 썸네일 튐을 방지한다.
        if (firstVideoUrl) {
          const cachedThumb = videoThumbCacheRef.current.get(post.id);
          if (cachedThumb) {
            const img = content.querySelector('img') as HTMLImageElement | null;
            if (img) img.src = cachedThumb;
          } else if (!storedVideoPoster) {
            extractVideoThumbRef.current(post.id, firstVideoUrl);
          }
        }
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        if (existingOverlay.getMap() === null) {
          existingOverlay.setMap(mapInstance.current);
        }

        if (content.getAttribute('data-position-state') !== positionStateKey) {
          existingOverlay.setPosition(position);
          content.setAttribute('data-position-state', positionStateKey);
        }
        
        if (content.getAttribute('data-content-state') !== contentStateKey) {
          if (!highlightingIdsRef.current.has(post.id)) {
            content.innerHTML = getMarkerInnerHtml(post, isViewed);
            content.setAttribute('data-content-state', contentStateKey);
            scheduleMarkerFloat(String(post.id), content);
            scheduleOverlapBadgeUpdateRef.current();
          } else {
            content.setAttribute('data-content-state', contentStateKey);
          }
        }
      }
    });

    scheduleMarkerViewportVisibilityUpdate(false);
  }, [posts, isMapReady, authUser, videoThumbRevision, scheduleMarkerViewportVisibilityUpdate, clearViewportAnimationTimer, clearMarkerFloatTimer, scheduleMarkerFloat]);

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
      const forcePop = !!e.detail?.forcePop;

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
              const firstVideoUrlNow = !pNow.isAd
                ? (pNow.videoUrl || (Array.isArray(pNow.videoUrls) ? pNow.videoUrls.find((url) => typeof url === 'string' && url.trim()) : ''))
                : '';
              const hasThumbKeyNow = firstVideoUrlNow ? (videoThumbCacheRef.current.has(pNow.id) ? '1' : '0') : '';
              const nowStateKey = `${pNow.borderType}-${pNow.isAd}-${!!pNow.isNewRealtime}-${isMineKeyNow}-${isAdPendingKeyNow}-${pNow.likes}-${hasThumbKeyNow}`;
              content.innerHTML = getMarkerInnerHtmlRef.current(pNow, false);
              content.setAttribute('data-content-state', nowStateKey);
              scheduleOverlapBadgeUpdateRef.current();
            }
            // 새로 업로드한 컨텐츠 또는 위치보기로 포커스된 컨텐츠는 highlight 시점에
            // pop-pop 등장을 한 번 더 강제 재생한다. 모바일에서 지도 bounds 안정화 전에
            // 일시적으로 viewport 밖으로 판정되어 페이드 경로를 타는 경우도 여기서 보정한다.
            if (pNow?.isNewRealtime || forcePop) {
              content.classList.remove('marker-viewport-hidden', 'markers-hidden', 'markers-revealing');
              content.classList.remove('marker-appear-animation');
              void content.offsetWidth;
              content.classList.add('marker-appear-animation');
            }

            // marker-appear-animation은 유지 — 새 컨텐츠 생성 시 pop! 등장이
            // 끊기지 않도록 그대로 두고, highlighted와 동시에 재생되도록 한다.
            // (.highlighted.marker-appear-animation은 CSS에서 등장 애니메이션을 허용)
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
                const firstVideoUrl2 = !p2.isAd
                  ? (p2.videoUrl || (Array.isArray(p2.videoUrls) ? p2.videoUrls.find((url) => typeof url === 'string' && url.trim()) : ''))
                  : '';
                const hasThumbKey2 = firstVideoUrl2 ? (videoThumbCacheRef.current.has(p2.id) ? '1' : '0') : '';
                const finalStateKey = `${p2.borderType}-${p2.isAd}-${!!p2.isNewRealtime}-${isMineKey2}-${isAdPendingKey2}-${p2.likes}-${hasThumbKey2}`;
                content.classList.remove('marker-appear-animation');
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
        onVisibleMarkerIdsChangeRef.current?.([]);
        // 진행 중인 removalTimeout도 모두 취소
        removalTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        removalTimeoutsRef.current.clear();
        viewportAnimationTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        viewportAnimationTimersRef.current.clear();
        markerFloatTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        markerFloatTimersRef.current.clear();
        // 고스트 마커도 함께 즉시 제거
        ghostOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
        ghostOverlaysRef.current.clear();
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

    const setMapMoving = (moving: boolean) => {
      containerRef.current?.classList.toggle('map-is-moving', moving);
    };

    const handleMarkerViewportChange = () => {
      if (isDraggingViewportRef.current) return;
      scheduleMarkerViewportVisibilityUpdate(true);
    };

    const handleViewportDragStart = () => {
      isDraggingViewportRef.current = true;
      setMapMoving(true);
    };

    const handleViewportDragEnd = () => {
      isDraggingViewportRef.current = false;
      setMapMoving(false);
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
      setMapMoving(false);
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

    // 카카오 공식 옵션: 레벨 차이가 2 이하일 때만 animate 효과가 적용됨.
    // 큰 점프(예: 14→3)는 자동으로 즉시 변경되므로 항상 켜둬도 안전.
    const levelDiff = Math.abs(currentMapLevel - targetLevel);
    const shouldAnimate = levelDiff <= 2;
    map.setLevel(targetLevel, shouldAnimate ? { animate: { duration: 280 } } : { animate: false });
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
    containerRef.current?.classList.add('map-is-moving');
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
        containerRef.current?.classList.remove('map-is-moving');
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

  // ── 고스트(만료) 마커 동기화 ──────────────────────────────────────────
  // 일반 마커와 동일하게:
  //   - 후보(ghostCandidates)에 포함된 마커는 오버레이를 유지하고,
  //     viewport 진입/이탈은 opacity 클래스 토글로만 처리해 부드러운 페이드 인/아웃을 보여준다.
  //   - 후보에서 빠진 마커(만료 데이터 새로고침으로 사라진 경우)는 기존처럼 페이드아웃 후 제거.
  //   - 줌 레벨 7 이상이거나 마커 숨김 모드일 때는 모두 제거.
  const syncGhostMarkers = useCallback(() => {
    const kakao = (window as any).kakao;
    const map = mapInstance.current;
    if (!isMapReady || !map || !kakao?.maps?.CustomOverlay) return;

    // 줌 레벨 7 이상이면 고스트 마커도 모두 제거 (활성 마커와 동일 정책).
    // 단, 페이드아웃 애니메이션을 재생한 뒤 setMap(null)로 정리한다.
    if (map.getLevel() >= 7) {
      ghostOverlaysRef.current.forEach((overlay, id) => {
        const content = overlay.getContent() as HTMLElement | null;
        if (content && !content.classList.contains('ghost-disappear')) {
          content.classList.add('ghost-disappear');
          window.setTimeout(() => {
            const cur = ghostOverlaysRef.current.get(id);
            if (cur && cur === overlay) {
              cur.setMap(null);
              ghostOverlaysRef.current.delete(id);
            }
          }, 410);
        } else if (!content) {
          overlay.setMap(null);
          ghostOverlaysRef.current.delete(id);
        }
      });
      return;
    }

    // 후보 우선순위 상위 N개를 "유지 대상"으로 선정 (viewport 무관).
    // viewport 밖 마커도 오버레이로 유지해 두고, 재진입 시 페이드 인 효과를 살린다.
    let bounds: any;
    let sw: any;
    let ne: any;
    try {
      bounds = map.getBounds();
      sw = bounds.getSouthWest();
      ne = bounds.getNorthEast();
    } catch {
      return;
    }
    const minLat = Math.min(sw.getLat(), ne.getLat());
    const maxLat = Math.max(sw.getLat(), ne.getLat());
    const minLng = Math.min(sw.getLng(), ne.getLng());
    const maxLng = Math.max(sw.getLng(), ne.getLng());

    const candidates = ghostCandidatesRef.current;
    const kept = candidates.slice(0, GHOST_MARKER_MAX_VISIBLE).map(c => c.post);
    const keptIds = new Set<string>(kept.map(p => String(p.id)));

    // 후보에서 빠진 ghost 오버레이는 페이드아웃 애니메이션 후 제거
    ghostOverlaysRef.current.forEach((overlay, id) => {
      if (!keptIds.has(id)) {
        const content = overlay.getContent() as HTMLElement | null;
        if (content && !content.classList.contains('ghost-disappear')) {
          content.classList.add('ghost-disappear');
          window.setTimeout(() => {
            const cur = ghostOverlaysRef.current.get(id);
            if (cur && cur === overlay) {
              cur.setMap(null);
              ghostOverlaysRef.current.delete(id);
            }
          }, 410);
        } else if (!content) {
          overlay.setMap(null);
          ghostOverlaysRef.current.delete(id);
        }
      }
    });

    // 기존 ghost 오버레이의 viewport 진입/이탈에 따른 처리
    ghostOverlaysRef.current.forEach((overlay, id) => {
      if (!keptIds.has(id)) return;
      const content = overlay.getContent() as HTMLElement | null;
      if (!content) return;
      // 후보에서 빠지는 페이드아웃 중인 마커는 건드리지 않음
      if (content.classList.contains('ghost-disappear')) return;
      const post = kept.find(p => String(p.id) === id);
      if (!post) return;
      const inViewport =
        post.lat >= minLat && post.lat <= maxLat &&
        post.lng >= minLng && post.lng <= maxLng;
      const wasHidden = content.classList.contains('ghost-marker-viewport-hidden');
      if (inViewport) {
        if (wasHidden) {
          // viewport 밖 → 안: 일반 마커의 등장 애니메이션과 동일하게 keyframe 재생
          content.classList.remove('ghost-marker-viewport-hidden');
          content.classList.remove('ghost-marker-appear-animation');
          // reflow 후 재추가해야 애니메이션이 재시작됨
          void content.offsetWidth;
          content.classList.add('ghost-marker-appear-animation');
          // 애니메이션이 끝나면 클래스를 떼서, 이후 display 토글 등으로
          // keyframe이 재생되지 않도록 함 (base .ghost-marker-container의
          // opacity:0.7이 최종 상태를 유지).
          const onEnd = (e: AnimationEvent) => {
            if (e.animationName !== 'ghost-marker-appear') return;
            content.classList.remove('ghost-marker-appear-animation');
            content.removeEventListener('animationend', onEnd);
          };
          content.addEventListener('animationend', onEnd);
        }
      } else {
        // viewport 안 → 밖: opacity로 부드럽게 페이드 아웃
        content.classList.remove('ghost-marker-appear-animation');
        content.classList.add('ghost-marker-viewport-hidden');
      }
    });

    // 새로 추가된 ghost 마커 오버레이 생성 (viewport 안/밖 모두)
    kept.forEach((post) => {
      const id = String(post.id);
      if (ghostOverlaysRef.current.has(id)) return;

      const inViewport =
        post.lat >= minLat && post.lat <= maxLat &&
        post.lng >= minLng && post.lng <= maxLng;

      const content = document.createElement('div');
      // viewport 안에서 새로 생성되는 마커는 일반 마커의 marker-appear-animation과
      // 동일한 keyframe 등장 애니메이션(스케일+페이드)을 재생한다.
      // viewport 밖이면 hidden 상태로 두고, 나중에 안으로 들어올 때 등장 애니메이션 재생.
      content.className = inViewport
        ? 'ghost-marker-container ghost-marker-appear-animation'
        : 'ghost-marker-container ghost-marker-viewport-hidden';
      // 클릭 시 일반 마커처럼 onMarkerClick 호출
      content.onclick = (e) => {
        e.stopPropagation();
        if (isDragging.current) return;
        onMarkerClickRef.current(post);
      };

      // 영상 포스트면 회색 점 중앙에 작은 ▶ 아이콘만 추가로 표시한다.
      // 이외 동작/디자인은 기존과 동일.
      const ghostFirstVideoUrl = (() => {
        const single = typeof (post as any).videoUrl === 'string' && (post as any).videoUrl.trim()
          ? (post as any).videoUrl
          : (typeof (post as any).video_url === 'string' && (post as any).video_url.trim() ? (post as any).video_url : '');
        if (single) return single;
        const arr = Array.isArray((post as any).videoUrls)
          ? (post as any).videoUrls
          : (Array.isArray((post as any).video_urls) ? (post as any).video_urls : []);
        return arr.find((u: unknown) => typeof u === 'string' && (u as string).trim()) || '';
      })();
      const ghostHasVideo = !!ghostFirstVideoUrl;
      const cachedGhostThumb = ghostHasVideo ? (videoThumbCacheRef.current.get(id) || '') : '';

      // 썸네일 결정 - 비디오 캐시 활용. 깨진/목업 URL이면 빈 회색 점.
      // image_url이 빠진 옛 포스트도 images 배열에 -opening-thumb.jpg가 있을 수 있으므로 폴백한다.
      let img = cachedGhostThumb || (post as any).image_url || (post as any).image || '';
      const tryImagesArray = () => {
        const arr = Array.isArray((post as any).images) ? (post as any).images : [];
        return arr.find((u: unknown) => {
          if (typeof u !== 'string' || !u || u === 'null' || u === 'undefined') return false;
          if (u.startsWith('blob:')) return false;
          const lo = u.toLowerCase().split('?')[0];
          return !(lo.endsWith('.mp4') || lo.endsWith('.mov') || lo.endsWith('.webm') || lo.endsWith('.avi') || lo.endsWith('.m4v'));
        }) || '';
      };
      const isBroken = !img || img === 'null' || img === 'undefined' || (typeof img === 'string' && img.startsWith('blob:'));
      const lower = typeof img === 'string' ? img.toLowerCase().split('?')[0] : '';
      const isImgVideoUrl = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.m4v');
      if (isBroken || isImgVideoUrl) {
        const arrFallback = tryImagesArray();
        if (arrFallback) {
          img = arrFallback;
        } else {
          img = cachedGhostThumb || '';
        }
      }
      if (ghostHasVideo && ghostFirstVideoUrl && !cachedGhostThumb) {
        extractVideoThumbRef.current(id, ghostFirstVideoUrl);
      }
      const optimized = img
        ? (isGeneratedVideoThumbnailUrl(img) ? img : getOptimizedMarkerImage(img, id))
        : '';

      const ghostPlayIconHtml = ghostHasVideo

        ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;background:rgba(255,255,255,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>`
        : '';
      const ghostBubbleReflectionHtml = `<div class="marker-bubble-reflection" style="position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:4;overflow:hidden;">
        <div style="position:absolute;inset:1px;border-radius:50%;border:1px solid transparent;background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01)) padding-box,conic-gradient(from 205deg,rgba(255,166,190,0.18),rgba(255,224,163,0.16),rgba(255,255,255,0.06),rgba(147,197,253,0.16),rgba(196,181,253,0.18),rgba(255,166,190,0.18)) border-box;opacity:0.34;"></div>
        <div style="position:absolute;inset:5px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);"></div>
        <div style="position:absolute;top:6px;left:8px;width:24px;height:14px;border-radius:999px;transform:rotate(-18deg);background:radial-gradient(ellipse at 34% 38%,rgba(255,255,255,0.58) 0 20%,rgba(255,255,255,0.16) 42%,rgba(255,255,255,0.04) 64%,transparent 84%);filter:blur(0.45px);"></div>
        <div style="position:absolute;top:10px;right:9px;width:13px;height:9px;border-radius:999px;transform:rotate(24deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0.34) 0 22%,rgba(255,255,255,0.08) 54%,transparent 80%);filter:blur(0.35px);"></div>
        <div style="position:absolute;top:19px;left:18px;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.34) 0 24%,rgba(255,255,255,0.05) 56%,transparent 82%);filter:blur(0.2px);"></div>
        <div style="position:absolute;right:11px;bottom:9px;width:18px;height:9px;border-radius:999px;transform:rotate(-18deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0.04) 0 24%,rgba(255,255,255,0.01) 52%,transparent 80%);"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 28% 18%,rgba(255,255,255,0.08) 0 10%,transparent 28%),radial-gradient(circle at 68% 84%,rgba(255,214,170,0.03) 0 10%,transparent 30%),radial-gradient(circle at 50% 115%,rgba(255,255,255,0.04) 0 14%,rgba(15,23,42,0.025) 34%,transparent 56%),linear-gradient(160deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 18%,transparent 40%,rgba(59,130,246,0.02) 74%,rgba(15,23,42,0.02) 100%);"></div>
      </div>`;

      content.innerHTML = `<div class="ghost-marker-dot">${
        optimized ? `<img src="${optimized}" alt="" />` : ''
      }${ghostBubbleReflectionHtml}${ghostPlayIconHtml}</div>`;

      // 롱프레스 숨김 모드면 즉시 숨김
      if (markersHiddenRef.current) {
        content.classList.add('markers-hidden');
      }

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(post.lat, post.lng),
        content,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 200, // 활성 마커(300+)보다 아래
      });
      overlay.setMap(map);
      ghostOverlaysRef.current.set(id, overlay);

      // 등장 애니메이션이 끝나면 클래스를 떼서, 이후 부모의 display 토글 등으로
      // keyframe이 재생되지 않도록 한다. base .ghost-marker-container가
      // opacity:0.7을 가지므로 최종 상태는 그대로 유지됨.
      if (inViewport) {
        const onEnd = (e: AnimationEvent) => {
          if (e.animationName !== 'ghost-marker-appear') return;
          content.classList.remove('ghost-marker-appear-animation');
          content.removeEventListener('animationend', onEnd);
        };
        content.addEventListener('animationend', onEnd);
      }
    });
  }, [isMapReady]);

  const ghostUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleGhostMarkerUpdate = useCallback(() => {
    if (ghostUpdateTimerRef.current) clearTimeout(ghostUpdateTimerRef.current);
    ghostUpdateTimerRef.current = setTimeout(() => {
      ghostUpdateTimerRef.current = null;
      syncGhostMarkers();
    }, 60);
  }, [syncGhostMarkers]);

  // 후보 목록이 바뀌거나 지도가 준비되면 즉시 sync (디바운스 없이 바로 표시 →
  // 일반 마커와 동일한 타이밍에 등장하도록).
  useEffect(() => {
    if (!isMapReady) return;
    if (ghostUpdateTimerRef.current) {
      clearTimeout(ghostUpdateTimerRef.current);
      ghostUpdateTimerRef.current = null;
    }
    syncGhostMarkers();
  }, [isMapReady, ghostCandidates, syncGhostMarkers]);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const map = mapInstance.current;
    kakao.maps.event.addListener(map, 'idle', scheduleGhostMarkerUpdate);
    kakao.maps.event.addListener(map, 'zoom_changed', scheduleGhostMarkerUpdate);
    kakao.maps.event.addListener(map, 'dragend', scheduleGhostMarkerUpdate);
    return () => {
      kakao.maps.event.removeListener(map, 'idle', scheduleGhostMarkerUpdate);
      kakao.maps.event.removeListener(map, 'zoom_changed', scheduleGhostMarkerUpdate);
      kakao.maps.event.removeListener(map, 'dragend', scheduleGhostMarkerUpdate);
    };
  }, [isMapReady, scheduleGhostMarkerUpdate]);

  // 언마운트 시 ghost 오버레이 정리
  useEffect(() => {
    return () => {
      if (ghostUpdateTimerRef.current) clearTimeout(ghostUpdateTimerRef.current);
      ghostOverlaysRef.current.forEach((o) => {
        try { o.setMap(null); } catch {}
      });
      ghostOverlaysRef.current.clear();
    };
  }, []);

  // ── 마커 겹침 배지 업데이트 ──────────────────────────────────────────
  const updateOverlapBadges = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;

    const now = Date.now();
    const activeRecentPosts = new Map<string, any>();
    postsRef.current.forEach((post) => {
      const id = post?.id == null ? '' : String(post.id);
      const createdMs = getPostCreatedAtMs(post);
      if (!id || !isMarkerExpirable(post) || createdMs === null) return;
      if (now - createdMs >= MARKER_LIFESPAN_MS) return;
      activeRecentPosts.set(id, post);
    });

    const getDirectBadge = (content: HTMLElement) => Array.from(content.children).find(
      el => el.classList.contains('overlap-badge')
    ) as HTMLElement | undefined;

    const removeBadge = (content: HTMLElement) => {
      const existingBadge = getDirectBadge(content);
      if (existingBadge) existingBadge.remove();
    };

    type MarkerInfo = { id: string; overlay: any; rect: DOMRect; top: number };
    const markerInfos: MarkerInfo[] = [];

    overlaysRef.current.forEach((overlay, rawId) => {
      const id = String(rawId);
      const content = overlay.getContent() as HTMLElement | null;
      if (!content) return;

      if (
        overlay.getMap?.() === null ||
        !activeRecentPosts.has(id) ||
        content.classList.contains('marker-disappear-animation') ||
        content.classList.contains('marker-viewport-hidden') ||
        content.classList.contains('markers-hidden')
      ) {
        removeBadge(content);
        return;
      }

      const rect = content.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        removeBadge(content);
        return;
      }

      markerInfos.push({ id, overlay, rect, top: rect.top });
    });

    const OVERLAP_PADDING = 2;
    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - OVERLAP_PADDING &&
      a.right > b.left + OVERLAP_PADDING &&
      a.top < b.bottom - OVERLAP_PADDING &&
      a.bottom > b.top + OVERLAP_PADDING;

    const parent = new Map<string, string>();
    const find = (id: string): string => {
      const current = parent.get(id);
      if (!current || current === id) return id;
      const root = find(current);
      parent.set(id, root);
      return root;
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };

    for (const marker of markerInfos) parent.set(marker.id, marker.id);

    for (let i = 0; i < markerInfos.length; i++) {
      for (let j = i + 1; j < markerInfos.length; j++) {
        const a = markerInfos[i];
        const b = markerInfos[j];
        if (intersects(a.rect, b.rect)) union(a.id, b.id);
      }
    }

    const groupMap = new Map<string, MarkerInfo[]>();
    for (const marker of markerInfos) {
      const root = find(marker.id);
      if (!groupMap.has(root)) groupMap.set(root, []);
      groupMap.get(root)!.push(marker);
    }

    const representativeIds = new Set<string>();
    const countByRepresentativeId = new Map<string, number>();

    Array.from(groupMap.values()).forEach((group) => {
      if (group.length < 2) return;
      const representative = group.reduce((a, b) => (a.top < b.top ? a : b));
      representativeIds.add(representative.id);
      countByRepresentativeId.set(representative.id, group.length);
    });

    overlaysRef.current.forEach((overlay, rawId) => {
      const id = String(rawId);
      const content = overlay.getContent() as HTMLElement | null;
      if (!content) return;

      const existingBadge = getDirectBadge(content);
      const isRep = representativeIds.has(id);
      const count = countByRepresentativeId.get(id) ?? 1;

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
            'background:#fbbf24',
            'color:#111827',
            'font-size:11px',
            'font-weight:800',
            'border-radius:10px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'border:2px solid #ffffff',
            'box-shadow:0 2px 8px rgba(251,191,36,0.5)',
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
      } else if (existingBadge) {
        existingBadge.remove();
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
    if (videoThumbCacheRef.current.has(postId)) return;
    if (videoThumbPendingRef.current.has(postId)) return;
    videoThumbPendingRef.current.add(postId);

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let candidateTimes: number[] = [];
    let candidateIndex = 0;
    let isDone = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      video.removeEventListener('seeked', captureDecodedFrame);
      video.src = '';
      video.load();
    };

    const finish = (reason?: string) => {
      if (isDone) return;
      isDone = true;
      cleanup();
      videoThumbPendingRef.current.delete(postId);

      // 추출이 성공하지 못한 경우(captured 외)는 서버측에서 저장된 썸네일(image_url 등)을
      // 폴백으로 캐시에 넣어 빈 회색 버블이 남지 않게 한다. opening-thumb.jpg 같은
      // -thumb 패턴 URL도 영상 포스트에서는 신뢰한다.
      if (reason !== 'captured' && !videoThumbCacheRef.current.has(postId)) {
        const post = postsRef.current.find((p) => p && p.id === postId)
          || ghostCandidatesRef.current.find((entry) => entry.post && entry.post.id === postId)?.post;
        if (post) {
          const fallback = getStoredMarkerThumbnail(post);
          if (fallback) {
            videoThumbCacheRef.current.set(postId, fallback);
            setVideoThumbRevision((revision) => revision + 1);
            const overlay = overlaysRef.current.get(postId);
            const content = overlay?.getContent?.() as HTMLElement | null;
            const img = content?.querySelector('[data-video-marker-img="true"]') as HTMLImageElement | null;
            if (img) {
              img.src = fallback;
              img.style.opacity = '1';
            }
            const ghostOverlay = ghostOverlaysRef.current.get(postId);
            const ghostContent = ghostOverlay?.getContent?.() as HTMLElement | null;
            const ghostImg = ghostContent?.querySelector('.ghost-marker-dot img') as HTMLImageElement | null;
            if (ghostImg) {
              ghostImg.src = fallback;
              ghostImg.style.opacity = '0.78';
            }
          }
        }
      }
    };

    const isMostlyBlackFrame = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const data = ctx.getImageData(0, 0, width, height).data;
      let brightPixels = 0;
      let sampledPixels = 0;

      for (let i = 0; i < data.length; i += 4 * 12) {
        const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (luminance > 28) brightPixels += 1;
        sampledPixels += 1;
      }

      return sampledPixels > 0 && brightPixels / sampledPixels < 0.04;
    };

    const refreshMarkerWithCachedThumb = () => {
      const dataUrl = videoThumbCacheRef.current.get(postId);
      if (!dataUrl) return;

      const overlay = overlaysRef.current.get(postId);
      const content = overlay?.getContent?.() as HTMLElement | null;
      const img = content?.querySelector('[data-video-marker-img="true"]') as HTMLImageElement | null;
      if (img) {
        img.src = dataUrl;
        img.style.opacity = '1';
      }

      const state = content?.getAttribute('data-content-state');
      if (state && content) content.setAttribute('data-content-state', state.replace(/-[01]$/, '-1'));

      const ghostOverlay = ghostOverlaysRef.current.get(postId);
      const ghostContent = ghostOverlay?.getContent?.() as HTMLElement | null;
      const ghostImg = ghostContent?.querySelector('.ghost-marker-dot img') as HTMLImageElement | null;
      if (ghostImg) {
        ghostImg.src = dataUrl;
        ghostImg.style.opacity = '0.78';
      }
    };

    const seekNextCandidate = () => {
      if (isDone) return;

      const nextTime = candidateTimes[candidateIndex];
      candidateIndex += 1;

      if (typeof nextTime !== 'number') {
        finish('no-candidate-time');
        return;
      }

      if (nextTime <= 0) {
        captureDecodedFrame();
        return;
      }

      try { video.currentTime = nextTime; } catch { captureDecodedFrame(); }
    };

    const capture = () => {
      if (isDone) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) { finish('no-canvas-context'); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const isBlack = isMostlyBlackFrame(ctx, canvas.width, canvas.height);

        if (isBlack && candidateIndex < candidateTimes.length) {
          seekNextCandidate();
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        videoThumbCacheRef.current.set(postId, dataUrl);
        setVideoThumbRevision((revision) => revision + 1);
        finish('captured');
        refreshMarkerWithCachedThumb();
      } catch {
        finish('capture-error');
      }
    };

    function captureDecodedFrame() {
      if (isDone) return;
      window.setTimeout(capture, 80);
    }

    const moveToFirstVisibleFrame = () => {
      if (isDone) return;

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const rawTimes = duration > 0.2
        ? [0.35, 0.7, 1.2, 2].filter((time) => time < duration - 0.05)
        : [0];
      candidateTimes = Array.from(new Set(rawTimes.length > 0 ? rawTimes : [0]));
      candidateIndex = 0;
      seekNextCandidate();
    };

    video.addEventListener('loadedmetadata', moveToFirstVisibleFrame, { once: true });
    video.addEventListener('seeked', captureDecodedFrame);
    video.addEventListener('error', () => finish('video-error'), { once: true });

    timeoutId = window.setTimeout(() => finish('timeout'), 8000);

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
          <div style="width:auto;min-width:34px;background:linear-gradient(90deg,#94a3b8,#cbd5e1,#94a3b8);color:white;font-size:9px;font-weight:900;padding:3px 8px;border-radius:999px;text-align:center;box-sizing:border-box;letter-spacing:0.05em;margin-bottom:-7px;position:relative;z-index:3;line-height:1.1;border:2px solid rgba(255,255,255,0.9);box-shadow:0 3px 10px rgba(100,116,139,0.22);">AD</div>
          <div style="width:60px;height:60px;border-radius:50%;position:relative;z-index:2;border:3px solid #94a3b8;box-shadow:0 10px 22px rgba(15,23,42,0.16),inset 0 2px 8px rgba(255,255,255,0.9),inset 0 -9px 16px rgba(15,23,42,0.10);background:radial-gradient(circle at 30% 22%,rgba(255,255,255,0.95) 0 10%,rgba(241,245,249,0.95) 28%,#e2e8f0 100%);box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <div style="position:absolute;top:8px;left:12px;width:18px;height:10px;border-radius:999px;background:rgba(255,255,255,0.72);transform:rotate(-25deg);filter:blur(0.2px);pointer-events:none;"></div>
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px;position:relative;z-index:2;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style="font-size:8px;font-weight:800;color:#94a3b8;letter-spacing:-0.02em;line-height:1;">준비중</span>
            </div>
          </div>
        </div>
      </div>`;
    }

    const currentUser = authUserRef.current;
    const isMine = !!(currentUser && String((post.owner_id || post.user_id || '')) === String(currentUser.id));

    // 광고가 아니고 영상이 있으면 재생 아이콘 표시

    const firstVideoUrl = !isAd
      ? (post.videoUrl || (Array.isArray(post.videoUrls) ? post.videoUrls.find((url: unknown) => typeof url === 'string' && url.trim()) : ''))
      : '';
    const hasVideo = !!firstVideoUrl;

    let displayImage = getStoredMarkerThumbnail(post);

    // 저장된 썸네일이 없는 오래된 비디오 포스트에 대해서만 추출 캐시를 사용한다.
    if (hasVideo && !displayImage) {
      const cached = videoThumbCacheRef.current.get(post.id);
      if (cached) displayImage = cached;
    }

    const optimizedDisplayImage = displayImage
      ? (isGeneratedVideoThumbnailUrl(displayImage) ? displayImage : getOptimizedMarkerImage(displayImage, String(post.id)))
      : '';

    let borderType = post.borderType || 'none';
    let labelText = ''; let labelBg = ''; let labelColor = 'white';
    if (isAd) { labelText = 'AD'; labelBg = 'ad-rainbow'; }
    else if (borderType === 'popular') { labelText = 'HOT'; labelBg = '#ef4444'; }
    else if (borderType === 'diamond') { labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; }
    else if (borderType === 'gold') { labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; }
    else if (borderType === 'silver') { labelText = 'SILVER'; labelBg = '#94a3b8'; labelColor = 'white'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = (labelText && !isAd) ? `<div style="width:auto;min-width:34px;background:${labelBg};color:${labelColor};font-size:9px;font-weight:900;padding:3px 8px;border-radius:999px;text-align:center;box-sizing:border-box;letter-spacing:0.05em;margin-bottom:-7px;position:relative;z-index:3;text-shadow:0 1px 2px rgba(0,0,0,0.2);box-shadow:0 3px 10px rgba(0,0,0,0.16);line-height:1.1;border:2px solid rgba(255,255,255,0.9);">${labelText}</div>` : '';

    const animationClass = 'animate-marker-float';

    let inlineBorderStyle = "border: 3px solid #ffffff;";
    let inlineShadow = "0 6px 14px rgba(15, 23, 42, 0.16), inset 0 2px 8px rgba(255, 255, 255, 0.55), inset 0 -10px 18px rgba(15, 23, 42, 0.16)";
    let influencerClass = "";

    if (isMine) {
      inlineBorderStyle = "border: 3px solid #4f46e5;";
    }
    else if (isAd) { inlineBorderStyle = "border: 4.5px solid #2563eb;"; }
    else if (borderType === 'popular') { inlineBorderStyle = "border: 4.5px solid #ef4444;"; }
    else if (borderType === 'diamond') { inlineBorderStyle = "border: 4.5px solid #22d3ee;"; }
    else if (borderType === 'gold') { inlineBorderStyle = "border: 4.5px solid #fbbf24;"; }
    else if (borderType === 'silver') { inlineBorderStyle = "border: 4.5px solid #94a3b8;"; }

    const adStyleTag = isAd ? `<style>
      @keyframes _ad_flip { 0%,75%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
      @keyframes _tornado_outer { 0%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(90deg) scale(1.15)} 50%{transform:rotate(180deg) scale(1)} 75%{transform:rotate(270deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
      @keyframes _tornado_inner { 0%{transform:rotate(0deg) scale(1.2)} 100%{transform:rotate(-360deg) scale(1.2)} }
      ._ad_lbl { position:relative; overflow:hidden; width:auto; min-width:34px; color:white; font-size:9px; font-weight:900; padding:3px 8px; border-radius:999px; text-align:center; box-sizing:border-box; letter-spacing:0.05em; margin-bottom:-7px; z-index:3; line-height:1.1; border:2px solid rgba(255,255,255,0.9); box-shadow:0 3px 8px rgba(15,23,42,0.16); }
      ._ad_lbl::before { content:""; position:absolute; inset:-60%; border-radius:50%; background:conic-gradient(from 0deg,#1d4ed8 0deg,#3b82f6 60deg,#60a5fa 90deg,#93c5fd 120deg,#2563eb 180deg,#1e40af 240deg,#3b82f6 300deg,#1d4ed8 360deg); animation:_tornado_outer 1.2s linear infinite; z-index:0; }
      ._ad_lbl::after { content:""; position:absolute; inset:-40%; border-radius:50%; background:conic-gradient(from 0deg,rgba(99,102,241,0.9) 0deg,rgba(59,130,246,0.7) 90deg,rgba(147,197,253,0.5) 150deg,rgba(37,99,235,0.9) 210deg,rgba(99,102,241,0.7) 270deg,rgba(59,130,246,0.9) 330deg,rgba(99,102,241,0.9) 360deg); animation:_tornado_inner 0.8s linear infinite; z-index:1; }
      ._ad_lbl_txt { position:relative; z-index:2; text-shadow:0 1px 3px rgba(0,0,0,0.5); }
    </style>` : '';

    const adLabelHtml = isAd
      ? `<div class="_ad_lbl"><span class="_ad_lbl_txt">AD</span></div>`
      : '';

    const adSparklesHtml = '';

    const adGlowLayer = '';

    const innerBoxBackground = hasVideo && !optimizedDisplayImage && !videoThumbCacheRef.current.get(post.id)
      ? 'background:radial-gradient(circle at 26% 18%,rgba(255,255,255,0.14) 0 10%,transparent 30%),linear-gradient(150deg,#111827 0%,#1f2937 58%,#334155 100%);'
      : 'background:radial-gradient(circle at 26% 18%,rgba(255,255,255,0.09) 0 8%,transparent 27%),linear-gradient(155deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 34%,rgba(148,163,184,0.04) 100%);';
    const innerBoxStyle = `width:60px;height:60px;border-radius:50%;position:relative;z-index:2;${inlineBorderStyle}box-shadow:0 8px 16px rgba(15,23,42,0.12),0 0 0 1px rgba(255,255,255,0.05),inset 0 1px 4px rgba(255,255,255,0.12),inset 0 -6px 10px rgba(15,23,42,0.05);${innerBoxBackground}box-sizing:border-box;overflow:hidden;`;
    const bubbleReflectionHtml = `<div class="marker-bubble-reflection" style="position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:4;overflow:hidden;">
      <div style="position:absolute;inset:1px;border-radius:50%;border:1.2px solid transparent;background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)) padding-box,conic-gradient(from 205deg,rgba(255,166,190,0.34),rgba(255,224,163,0.30),rgba(255,255,255,0.10),rgba(147,197,253,0.30),rgba(196,181,253,0.32),rgba(255,166,190,0.34)) border-box;opacity:0.58;"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(255,255,255,0.14);"></div>
      <div style="position:absolute;top:5px;left:7px;width:29px;height:17px;border-radius:999px;transform:rotate(-18deg);background:radial-gradient(ellipse at 34% 38%,rgba(255,255,255,0.84) 0 22%,rgba(255,255,255,0.28) 44%,rgba(255,255,255,0.06) 66%,transparent 84%);filter:blur(0.2px);"></div>
      <div style="position:absolute;top:9px;right:8px;width:16px;height:11px;border-radius:999px;transform:rotate(24deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0.54) 0 24%,rgba(255,255,255,0.12) 56%,transparent 80%);"></div>
      <div style="position:absolute;top:18px;left:18px;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.60) 0 26%,rgba(255,255,255,0.08) 60%,transparent 82%);"></div>
      <div style="position:absolute;right:11px;bottom:9px;width:22px;height:11px;border-radius:999px;transform:rotate(-18deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,0.06) 0 26%,rgba(255,255,255,0.02) 54%,transparent 80%);"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 28% 18%,rgba(255,255,255,0.12) 0 12%,transparent 30%),radial-gradient(circle at 68% 84%,rgba(255,214,170,0.06) 0 12%,transparent 32%),radial-gradient(circle at 50% 115%,rgba(255,255,255,0.08) 0 16%,rgba(15,23,42,0.05) 36%,transparent 58%),linear-gradient(160deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 18%,transparent 40%,rgba(59,130,246,0.03) 74%,rgba(15,23,42,0.04) 100%);"></div>
    </div>`;

    // ── 24시간 카운트다운 형광 그린 링 ────────────────────────────────

    // 광고/광고대기 마커에는 표시하지 않음. createdAt이 없는 포스트도 skip.
    // path는 12시 방향에서 시작해 시계 반대방향으로 한 바퀴 도는 원형.
    const createdAtMs = getPostCreatedAtMs(post);
    const showCountdownRing = isMarkerExpirable(post) && createdAtMs !== null;
    const countdownRingHtml = showCountdownRing
      ? (() => {
          const elapsed = Math.min(Math.max(Date.now() - (createdAtMs as number), 0), MARKER_LIFESPAN_MS);
          const remainingRatio = 1 - elapsed / MARKER_LIFESPAN_MS;
          // 남은 비율 * 둘레 = 보여줄 stroke 길이
          // dashoffset을 음수로 두면 시작점(12시 상단 중앙)에서부터 깎이고,
          // path가 시계 반대방향으로 그려지므로 끝점이 반시계 방향으로 후퇴한다.
          const elapsedRatio = 1 - remainingRatio;
          const dashOffset = -(COUNTDOWN_RING_PERIMETER * elapsedRatio);
          // 마커 path는 12시에서 반시계 방향으로 그려지고 dashoffset은 음수.
          // 따라서 실제로 줄어드는 경계점은 '남은 비율'이 아니라 '경과 비율' 위치에 있다.
          const spark = getCountdownRingSparkPoint(elapsedRatio);
          const showSpark = remainingRatio > 0.01 && remainingRatio < 0.995;
          return `<svg class="marker-countdown-ring" data-created-at="${createdAtMs}" viewBox="0 0 ${COUNTDOWN_RING_BOX} ${COUNTDOWN_RING_BOX}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:12;overflow:visible;">
            <path class="marker-countdown-ring-track" d="${COUNTDOWN_RING_PATH}" fill="none" stroke="${COUNTDOWN_TRACK_COLOR}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            <path class="marker-countdown-ring-progress" d="${COUNTDOWN_RING_PATH}" fill="none" stroke="${COUNTDOWN_PROGRESS_COLOR}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${COUNTDOWN_RING_PERIMETER.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" style="filter:drop-shadow(${COUNTDOWN_GLOW});" />
            <g class="marker-countdown-ring-spark" transform="translate(${spark.x.toFixed(2)} ${spark.y.toFixed(2)})" style="display:${showSpark ? 'block' : 'none'};filter:drop-shadow(0 0 5px rgba(57,255,20,0.95));">
              <circle cx="0" cy="0" r="5" fill="rgba(57,255,20,0.22)">
                <animate attributeName="r" values="3;6;3" dur="1.15s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.75;0.25" dur="1.15s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="2.1" fill="#ecfccb" stroke="#39FF14" stroke-width="1">
                <animate attributeName="opacity" values="1;0.45;1" dur="0.75s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>`;
        })()
      : '';

    // AD 마커: 라벨+이미지 박스를 하나의 wrapper로 감싸서 함께 회전
    const adFlipWrapperStart = isAd
      ? `<div style="display:flex;flex-direction:column;align-items:center;width:60px;animation:_ad_flip 4s ease-in-out infinite;transform-style:preserve-3d;">`
      : '';
    const adFlipWrapperEnd = isAd ? `</div>` : '';

    const cachedVideoThumb = hasVideo ? videoThumbCacheRef.current.get(post.id) : '';
    const markerImage = cachedVideoThumb || optimizedDisplayImage;
    const imgContent = markerImage
      ? `<img ${hasVideo ? 'data-video-marker-img="true"' : ''} src="${markerImage}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:1;" />`
      : hasVideo
        ? `<img data-video-marker-img="true" alt="" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0;" />`
        : `<img src="${FALLBACK_IMAGE}" style="width:100%;height:100%;object-fit:cover;display:block;" />`;

    return `${adStyleTag}<div class="marker-content-wrapper">
      <div class="${animationClass}" style="display:flex;flex-direction:column;align-items:center;width:60px;position:relative;">
        <div class="marker-scaling-target" style="display:flex;flex-direction:column;align-items:center;width:60px;position:relative;">
          ${isAd ? adGlowLayer : ''}
          ${isAd ? adFlipWrapperStart : ''}
          ${isAd ? adLabelHtml : labelHtml}
          <div class="${influencerClass}" style="${innerBoxStyle}">
            ${isAd ? adSparklesHtml : ''}
            <div class="shine-overlay" style="width:100%;height:100%;position:relative;border-radius:50%;overflow:hidden;">
              ${imgContent}
              ${bubbleReflectionHtml}
              <div style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);background:#fef2f2;border:1px solid #fecaca;color:#ef4444;font-size:9px;font-weight:900;padding:2px 5px 2px 4px;border-radius:999px;z-index:5;line-height:1;display:flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 1px 3px rgba(0,0,0,0.12);white-space:nowrap;">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
                <span>${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}</span>
              </div>
              ${videoIconHtml}

              ${countdownRingHtml}
            </div>
          </div>
          ${isAd ? adFlipWrapperEnd : ''}
        </div>
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
      setMarkerExpiryNow(now);

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
              clearMarkerFloatTimer(String(id));
              scheduleOverlapBadgeUpdate();
            }
          }, 520);
          removalTimeoutsRef.current.set(id, removalTimer);
          scheduleOverlapBadgeUpdate();
          return;
        }

        // 아직 만료 전 → 진행 path의 dashoffset과 반짝임 위치만 갱신 (트랙은 정적이므로 그대로)
        const remainingRatio = 1 - elapsed / MARKER_LIFESPAN_MS;
        const dashOffset = -(COUNTDOWN_RING_PERIMETER * (1 - remainingRatio));
        const progressPath = ring.querySelector('.marker-countdown-ring-progress');
        if (progressPath) {
          progressPath.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));
        }

        const spark = ring.querySelector('.marker-countdown-ring-spark') as SVGGElement | null;
        if (spark) {
          // dashoffset이 경과 비율 기준으로 적용되므로 반짝임도 동일한 위치를 따라간다.
          const point = getCountdownRingSparkPoint(1 - remainingRatio);
          spark.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
          spark.style.display = remainingRatio > 0.01 && remainingRatio < 0.995 ? 'block' : 'none';
        }
      });
    };

    // 마운트 직후 한 번 즉시 실행 (마커가 이미 그려져 있는 상태에서 첫 정확한 값 반영)
    tick();
    const intervalId = window.setInterval(tick, MARKER_EXPIRY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isMapReady, clearViewportAnimationTimer, clearMarkerFloatTimer, scheduleOverlapBadgeUpdate]);

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