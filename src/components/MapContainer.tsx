"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';
import { getFallbackImage, getOptimizedMarkerImage } from '@/lib/utils';

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
}

const FALLBACK_IMAGE = "/placeholder.svg";


const LONG_PRESS_DURATION = 1000; // 1초
const LONG_PRESS_MOVE_THRESHOLD = 5; // px 이상 움직이면 취소 (드래그 감지를 빠르게)

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
}: MapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<number>(6);
  const [internalViewedIds, setInternalViewedIds] = useState<Set<string>>(new Set());

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
  const removalTimeoutsRef = useRef<Map<string, number>>(new Map());
  const searchOverlayRef = useRef<any>(null);
  const userLocationOverlayRef = useRef<any>(null);
  const highlightingIdsRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const lastDragEnd = useRef(0);
  const currentLevelRef = useRef<number>(6);
  const postsRef = useRef<any[]>(posts);
  const viewedPostIdsRef = useRef<Set<any>>(viewedPostIds);
  const internalViewedIdsRef = useRef<Set<string>>(new Set());
  const overlapBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 비디오 썸네일 캐시: postId → dataURL
  const videoThumbCacheRef = useRef<Map<string, string>>(new Map());
  // 현재 추출 중인 postId 집합 (중복 추출 방지)
  const videoThumbPendingRef = useRef<Set<string>>(new Set());
  // extractVideoThumbnailForMarker를 ref로 감싸서 마커 생성 useEffect에서 stale closure 없이 참조
  const extractVideoThumbRef = useRef<(postId: string, videoUrl: string) => void>(() => {});

  const pinchStartDistRef = useRef<number | null>(null);

  // ── 부드러운 줌 관련 refs ──────────────────────────────────────────────
  const smoothZoomWrapperRef = useRef<HTMLDivElement>(null);
  const currentScaleRef = useRef<number>(1);
  const targetScaleRef = useRef<number>(1);
  const scaleAnimFrameRef = useRef<number | null>(null);
  const isZoomingRef = useRef<boolean>(false);
  const zoomResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef<number>(0);
  const wheelAccumRef = useRef<number>(0);

  const centerRef = useRef(center);
  const levelRef = useRef(6);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { levelRef.current = level; }, [level]);

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

  // ── 현재 위치 오버레이 ──────────────────────────────────────
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;

    // 기존 오버레이 제거
    if (userLocationOverlayRef.current) {
      userLocationOverlayRef.current.setMap(null);
      userLocationOverlayRef.current = null;
    }

    if (!userLocation) return;

    const content = document.createElement('div');
    content.className = 'user-location-marker';
    content.innerHTML = `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        transform: translate(-50%, -50%);
      ">
        <!-- 정확도 파동 (큰 원) -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 48px; height: 48px;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.15);
          animation: user-loc-accuracy 2.4s ease-out infinite;
          pointer-events: none;
        "></div>
        <!-- 파동 링 -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 22px; height: 22px;
          border-radius: 50%;
          background: transparent;
          border: 2.5px solid rgba(66, 133, 244, 0.6);
          animation: user-loc-pulse 2.4s ease-out infinite;
          pointer-events: none;
        "></div>
        <!-- 흰 테두리 -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 22px; height: 22px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        "></div>
        <!-- 파란 점 -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #4285F4;
        "></div>
      </div>
    `;

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
      content: content,
      zIndex: 9000,
    });
    overlay.setMap(mapInstance.current);
    userLocationOverlayRef.current = overlay;
  }, [userLocation, isMapReady]);

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
            }
          }, 520);
        }
      } catch (err) {
        console.error('[MapContainer] Delete animation error:', err);
      }
    };
    window.addEventListener('animate-marker-delete', handleAnimateDelete);
    return () => window.removeEventListener('animate-marker-delete', handleAnimateDelete);
  }, []);

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
      if (!kakao?.maps?.Map || !kakao?.maps?.LatLng) return false;
      if (mapInstance.current) return true;

      // 카카오맵 초기 위치는 항상 mapCache.lastCenter(이전 세션 마지막 위치) 사용
      // centerRef.current(현재 prop)를 사용하면 routeState로 즉시 post 위치가 들어와
      // smoothMoveTo가 작동하지 않고 순간이동처럼 보이는 문제 발생
      const initialCenter = mapCache.lastCenter || { lat: 37.5665, lng: 126.9780 };
      const initialLevel = levelRef.current ?? 6;
      const map = new kakao.maps.Map(containerRef.current!, {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: initialLevel,
        scrollwheel: false,  // 카카오맵 기본 휠 줌 비활성화 (우리가 직접 처리)
        disableDoubleClickZoom: true, // 더블클릭 줌 비활성화
      });
      map.setMaxLevel(11);
      mapInstance.current = map;

      const updateZoomClass = () => {
        const lvl = map.getLevel();
        const el = containerRef.current;
        if (!el) return;
        el.className = el.className.replace(/\bzoom-\d+\b/g, '');
        el.classList.add(`zoom-${lvl}`);
      };

      const updateMapData = (forceInitial = false) => {
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

      updateZoomClass();

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
    const checkMap = setInterval(() => {
      if ((window as any).kakao?.maps) {
        const isInit = initMap();
        if (isInit) {
          clearInterval(checkMap);
          if (mapInstance.current) {
            // level prop 값을 우선 사용 (routeState로 zoom 전달 시 반영)
            const targetLevel = levelRef.current ?? 6;
            mapInstance.current.setLevel(targetLevel, { animate: false });
            setCurrentLevel(targetLevel);
            currentLevelRef.current = targetLevel;
          }
        }
      }
    }, 100);
    return () => clearInterval(checkMap);
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
            }
          }, 520);
          removalTimeoutsRef.current.set(id, removalTimer);
        } else if (!content) {
          overlay.setMap(null);
          overlaysRef.current.delete(id);
        }
      }
    });

    posts.forEach(post => {
      if (!post || post.lat === null || post.lng === null) return;
      const position = new kakao.maps.LatLng(post.lat, post.lng);

      const isViewed = combinedViewedIds.has(post.id);
      const isNew = !!post.isNewRealtime;
      const existingOverlay = overlaysRef.current.get(post.id);
      const isMineKey = !!(authUser && String(((post as any).owner_id || (post as any).user_id || '')) === String(authUser.id));
      const isAdPendingKey = !!(post as any).isAdPending;
      // 비디오 썸네일 캐시 여부를 key에 포함 → 썸네일 추출 완료 시 마커 갱신 트리거
      const hasThumbKey = (!post.isAd && post.videoUrl) ? (videoThumbCacheRef.current.has(post.id) ? '1' : '0') : '';
      const contentStateKey = `${isViewed}-${post.borderType}-${post.isAd}-${isNew}-${isMineKey}-${isAdPendingKey}-${post.likes}-${hasThumbKey}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        const isAdPost = post.isAd || (post.content && post.content.includes('[AD]'));
        content.className = 'marker-container kakao-overlay marker-appear-animation';
        if (isAdPost) content.classList.add('is-ad');
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
  }, [posts, isMapReady, authUser]);

  useEffect(() => {
    if (!isMapReady) return;
    const combinedViewedIds = new Set([...Array.from(viewedPostIds), ...Array.from(internalViewedIds)]);
    overlaysRef.current.forEach((overlay, id) => {
      if (highlightingIdsRef.current.has(id)) return;
      const content = overlay.getContent() as HTMLElement;
      if (!content) return;
      const stateKey = content.getAttribute('data-content-state') || '';
      const isViewed = combinedViewedIds.has(id);
      const currentIsViewed = stateKey.startsWith('true');
      if (isViewed === currentIsViewed) return;
      const p = postsRef.current.find(item => item.id === id);
      if (!p) return;
      const isMineKey = !!(authUserRef.current && String(((p as any).owner_id || (p as any).user_id || '')) === String(authUserRef.current.id));
      const isAdPendingKey = !!(p as any).isAdPending;
      const newStateKey = `${isViewed}-${p.borderType}-${p.isAd}-${!!p.isNewRealtime}-${isMineKey}-${isAdPendingKey}-${p.likes}`;
      content.innerHTML = getMarkerInnerHtmlRef.current(p, isViewed);
      content.setAttribute('data-content-state', newStateKey);
      scheduleOverlapBadgeUpdateRef.current();
    });
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
              const combinedViewedNow = new Set([
                ...Array.from(viewedPostIdsRef.current),
                ...Array.from(internalViewedIdsRef.current),
              ]);
              const isViewedNow = combinedViewedNow.has(postId);
              const isMineKeyNow = !!(authUserRef.current && String(((pNow as any).owner_id || (pNow as any).user_id || '')) === String(authUserRef.current.id));
              const isAdPendingKeyNow = !!(pNow as any).isAdPending;
              const nowStateKey = `${isViewedNow}-${pNow.borderType}-${pNow.isAd}-${!!pNow.isNewRealtime}-${isMineKeyNow}-${isAdPendingKeyNow}-${pNow.likes}`;
              content.innerHTML = getMarkerInnerHtmlRef.current(pNow, isViewedNow);
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
                const combinedViewed = new Set([
                  ...Array.from(viewedPostIdsRef.current),
                  ...Array.from(internalViewedIdsRef.current),
                ]);
                const isViewed2 = combinedViewed.has(postId);
                const isMineKey2 = !!(authUserRef.current && String(((p2 as any).owner_id || (p2 as any).user_id || '')) === String(authUserRef.current.id));
                const isAdPendingKey2 = !!(p2 as any).isAdPending;
                const finalStateKey = `${isViewed2}-${p2.borderType}-${p2.isAd}-${!!p2.isNewRealtime}-${isMineKey2}-${isAdPendingKey2}-${p2.likes}`;
                content.innerHTML = getMarkerInnerHtmlRef.current(p2, isViewed2);
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

      // 레벨 7 이상이면 React 렌더 사이클을 기다리지 않고 즉시 모든 마커 제거
      // disappear 애니메이션 없이 즉시 제거해야 깜빡임이 없음
      if (level >= 7) {
        overlaysRef.current.forEach((overlay) => {
          overlay.setMap(null);
        });
        overlaysRef.current.clear();
        // 진행 중인 removalTimeout도 모두 취소
        removalTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        removalTimeoutsRef.current.clear();
      }

      if (level < MIN_LEVEL) {
        const centerToRestore = lastAllowedCenter || map.getCenter();
        map.setLevel(MIN_LEVEL, { animate: false });
        map.setCenter(centerToRestore);
        const el = containerRef.current;
        if (el) {
          el.className = el.className.replace(/\bzoom-\d+\b/g, '');
          el.classList.add(`zoom-${MIN_LEVEL}`);
        }
        return;
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
    const timer = setInterval(() => {
      try {
        if (initMap()) clearInterval(timer);
      } catch (e) {
        console.error('Map init interval error:', e);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [initMap]);

  // level prop이 바뀌면 pendingLevelRef에 저장해두고,
  // smoothMoveTo가 진행 중이 아닐 때만 실제로 setLevel 적용
  const pendingLevelRef = useRef<number | null>(null);

  const applyLevel = useCallback((targetLevel: number) => {
    const map = mapInstance.current;
    if (!map) return;
    const savedCenter = map.getCenter();
    map.setLevel(targetLevel, { animate: false });
    // setLevel이 center를 리셋하는 경우 복원
    map.setCenter(savedCenter);
    const newLevel = map.getLevel();
    setCurrentLevel(newLevel);
    currentLevelRef.current = newLevel;
    pendingLevelRef.current = null;
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || level === undefined) return;
    if (levelTimerRef.current) clearTimeout(levelTimerRef.current);
    levelTimerRef.current = setTimeout(() => {
      levelTimerRef.current = null;
      if (animationFrameRef.current) {
        // smoothMoveTo 진행 중 → 완료 후 적용하도록 pending에 저장
        pendingLevelRef.current = level;
      } else {
        applyLevel(level);
      }
    }, 100);
    return () => {
      if (levelTimerRef.current) {
        clearTimeout(levelTimerRef.current);
        levelTimerRef.current = null;
      }
    };
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

    const projection = map.getProjection();
    if (!projection) return;

    const THRESHOLD = 62; // px - 마커 크기(60px) 기준

    // 현재 지도에 표시된 마커들의 픽셀 좌표 수집
    type MarkerInfo = { id: string; overlay: any; px: number; py: number };
    const markerInfos: MarkerInfo[] = [];

    overlaysRef.current.forEach((overlay, id) => {
      if (overlay.getMap() === null) return;
      try {
        const pos = overlay.getPosition();
        if (!pos) return;
        const point = projection.pointFromCoords(pos);
        if (!point) return;
        markerInfos.push({ id, overlay, px: point.x, py: point.y });
      } catch (e) {}
    });

    // 그리디 그룹핑
    const visited = new Set<string>();
    const groups: MarkerInfo[][] = [];

    for (const marker of markerInfos) {
      if (visited.has(marker.id)) continue;
      const group: MarkerInfo[] = [marker];
      visited.add(marker.id);

      for (const other of markerInfos) {
        if (visited.has(other.id)) continue;
        const dx = marker.px - other.px;
        const dy = marker.py - other.py;
        if (Math.sqrt(dx * dx + dy * dy) <= THRESHOLD) {
          group.push(other);
          visited.add(other.id);
        }
      }
      groups.push(group);
    }

    // 모든 마커에서 기존 배지 제거 (data-badge-count로 변경 여부 확인)
    // 그룹별로 대표 마커(최소 Y) 선정 후 배지 추가
    const representativeIds = new Set<string>();

    for (const group of groups) {
      if (group.length < 2) continue;
      // Y 픽셀이 가장 작은 마커 = 화면 최상단
      const rep = group.reduce((a, b) => (a.py < b.py ? a : b));
      representativeIds.add(rep.id);
    }

    // 배지 DOM 업데이트
    // 배지는 content(최상위 div)의 직접 자식으로 붙임 → innerHTML 교체에 영향 안 받음
    overlaysRef.current.forEach((overlay, id) => {
      if (overlay.getMap() === null) return;
      const content = overlay.getContent() as HTMLElement;
      if (!content) return;

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
            'background:#4f46e5',
            'color:#ffffff',
            'font-size:11px',
            'font-weight:800',
            'border-radius:10px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'border:2px solid #ffffff',
            'box-shadow:0 2px 8px rgba(79,70,229,0.45)',
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
  useEffect(() => {
    if (!isMapReady) return;
    scheduleOverlapBadgeUpdate();
  }, [posts, isMapReady, scheduleOverlapBadgeUpdate]);

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
              const combinedViewedIds = new Set([
                ...Array.from(viewedPostIdsRef.current),
                ...Array.from(internalViewedIdsRef.current),
              ]);
              const isViewed = combinedViewedIds.has(postId);
              const isMineKey = !!(authUserRef.current && String(((post as any).owner_id || (post as any).user_id || '')) === String(authUserRef.current.id));
              const isAdPendingKey = !!(post as any).isAdPending;
              const newStateKey = `${isViewed}-${post.borderType}-${post.isAd}-${!!post.isNewRealtime}-${isMineKey}-${isAdPendingKey}-${post.likes}-1`;
              content.innerHTML = getMarkerInnerHtmlRef.current(post, isViewed);
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

    const isSpecialPost = isMine || isAd || borderType !== 'none';
    const shineClass = isSpecialPost ? 'shine-overlay' : '';

    let inlineBorderStyle = "border: 3px solid #ffffff;";
    let inlineShadow = "0 6px 16px rgba(0, 0, 0, 0.12)";
    let influencerClass = "";

    if (isMine) { 
      inlineBorderStyle = "border: 4.5px solid #4f46e5;"; 
      inlineShadow = "0 0 15px rgba(79, 70, 229, 0.4)"; 
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
            <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);color:white;font-size:9px;font-weight:900;padding:1px 5px;border-radius:6px;z-index:5;border:1px solid rgba(255,255,255,0.2);line-height:1;">
              ${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}
            </div>
            ${videoIconHtml}
          </div>
        </div>
        ${isAd ? adFlipWrapperEnd : ''}
      </div>
    </div>`;
  };

  getMarkerInnerHtmlRef.current = getMarkerInnerHtml;

  // CSS 애니메이션 duration을 변수로 전달
  const circleCircumference = 2 * Math.PI * 13; // r=13

  // ── 부드러운 줌 (휠 + 핀치) ──────────────────────────────────────────
  // document 레벨에서 capture로 등록해야 카카오맵 내부 이벤트보다 먼저 처리됨
  useEffect(() => {
    const MIN_LEVEL = 3;
    const MAX_LEVEL = 11;

    const getWrapper = () => smoothZoomWrapperRef.current;
    const getContainer = () => containerRef.current;

    const animateScale = () => {
      const wrapper = getWrapper();
      if (!wrapper) { scaleAnimFrameRef.current = null; return; }
      const current = currentScaleRef.current;
      const target = targetScaleRef.current;
      const diff = target - current;
      if (Math.abs(diff) < 0.001) {
        currentScaleRef.current = target;
        wrapper.style.transform = `scale(${target})`;
        scaleAnimFrameRef.current = null;
        return;
      }
      const next = current + diff * 0.22;
      currentScaleRef.current = next;
      wrapper.style.transform = `scale(${next})`;
      scaleAnimFrameRef.current = requestAnimationFrame(animateScale);
    };

    const startScaleAnim = () => {
      if (scaleAnimFrameRef.current) cancelAnimationFrame(scaleAnimFrameRef.current);
      scaleAnimFrameRef.current = requestAnimationFrame(animateScale);
    };

    const resetScale = () => {
      const wrapper = getWrapper();
      if (!wrapper) return;
      currentScaleRef.current = 1;
      targetScaleRef.current = 1;
      wrapper.style.transform = 'scale(1)';
      wrapper.style.transformOrigin = 'center center';
    };

    const applyZoomLevel = (newLevel: number, pivotX?: number, pivotY?: number) => {
      const map = mapInstance.current;
      if (!map) return;
      const clamped = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, newLevel));
      map.setLevel(clamped, { animate: false });
      resetScale();
      wheelAccumRef.current = 0;
    };

    // ── 휠 ──
    const onWheel = (e: WheelEvent) => {
      const container = getContainer();
      if (!container || !container.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();

      const map = mapInstance.current;
      const wrapper = getWrapper();
      if (!map || !wrapper) return;

      lastWheelTimeRef.current = Date.now();
      wheelAccumRef.current += e.deltaY * 0.001;

      const lvl = map.getLevel();

      if (wheelAccumRef.current <= -0.4) {
        applyZoomLevel(lvl - 1);
        return;
      }
      if (wheelAccumRef.current >= 0.4) {
        applyZoomLevel(lvl + 1);
        return;
      }

      const visualScale = Math.max(0.78, Math.min(1.35, 1 - wheelAccumRef.current * 0.7));
      targetScaleRef.current = visualScale;
      const rect = container.getBoundingClientRect();
      wrapper.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
      startScaleAnim();

      if (zoomResetTimerRef.current) clearTimeout(zoomResetTimerRef.current);
      zoomResetTimerRef.current = setTimeout(() => {
        if (Date.now() - lastWheelTimeRef.current >= 280) {
          wheelAccumRef.current = 0;
          targetScaleRef.current = 1;
          getWrapper()!.style.transformOrigin = 'center center';
          startScaleAnim();
        }
      }, 320);
    };

    // ── 핀치 ──
    let pinchStartDist = 0;
    let pinchCenterX = 0;
    let pinchCenterY = 0;
    let isPinching = false;

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      const container = getContainer();
      if (!container || !container.contains(e.target as Node)) return;
      if (e.touches.length === 2) {
        isPinching = true;
        pinchStartDist = getDist(e.touches);
        pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const wrapper = getWrapper();
        const rect = container.getBoundingClientRect();
        if (wrapper && rect) {
          wrapper.style.transformOrigin = `${((pinchCenterX - rect.left) / rect.width) * 100}% ${((pinchCenterY - rect.top) / rect.height) * 100}%`;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const container = getContainer();
      if (!isPinching || e.touches.length !== 2) return;
      if (!container || !container.contains(e.target as Node)) return;

      e.preventDefault();
      e.stopPropagation();

      const wrapper = getWrapper();
      const map = mapInstance.current;
      if (!wrapper || !map || pinchStartDist === 0) return;

      const ratio = getDist(e.touches) / pinchStartDist;
      const lvl = map.getLevel();

      // CSS scale 즉각 반영
      const clamped = Math.max(0.5, Math.min(2.2, ratio));
      currentScaleRef.current = clamped;
      targetScaleRef.current = clamped;
      wrapper.style.transform = `scale(${clamped})`;

      // 임계점 도달 → 레벨 변경 후 새 핀치 시작점 리셋
      if (ratio >= 1.3 && lvl > MIN_LEVEL) {
        applyZoomLevel(lvl - 1);
        isPinching = false;
        setTimeout(() => {
          if (e.touches.length === 2) {
            isPinching = true;
            pinchStartDist = getDist(e.touches);
          }
        }, 80);
      } else if (ratio <= 0.77 && lvl < MAX_LEVEL) {
        applyZoomLevel(lvl + 1);
        isPinching = false;
        setTimeout(() => {
          if (e.touches.length === 2) {
            isPinching = true;
            pinchStartDist = getDist(e.touches);
          }
        }, 80);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        pinchStartDist = 0;
        targetScaleRef.current = 1;
        getWrapper()!.style.transformOrigin = 'center center';
        startScaleAnim();
      }
    };

    // capture: true → 카카오맵 내부 리스너보다 먼저 실행
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true } as any);
      document.removeEventListener('touchstart', onTouchStart, { capture: true } as any);
      document.removeEventListener('touchmove', onTouchMove, { capture: true } as any);
      document.removeEventListener('touchend', onTouchEnd, { capture: true } as any);
      document.removeEventListener('touchcancel', onTouchEnd, { capture: true } as any);
      if (scaleAnimFrameRef.current) cancelAnimationFrame(scaleAnimFrameRef.current);
      if (zoomResetTimerRef.current) clearTimeout(zoomResetTimerRef.current);
    };
  }, []);

  return (
    <div
      className="w-full h-full relative select-none touch-none"
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

      {/* 롱프레스 진행 표시 - CSS 애니메이션으로 부드럽게 */}
      {uiState === 'pressing' && (
        <div
          className="longpress-toast"
          style={{
            position: 'fixed',
            bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 16px)',
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
          {/* CSS 애니메이션 원형 진행 바 */}
          <svg
            width="32" height="32"
            viewBox="0 0 32 32"
            style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
          >
            {/* 배경 트랙 */}
            <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
            {/* 진행 원 - CSS 애니메이션으로 strokeDashoffset 변화 */}
            <circle
              cx="16" cy="16" r="13"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circleCircumference}
              strokeDashoffset={circleCircumference}
              style={{
                animation: `longpress-circle ${LONG_PRESS_DURATION - 500}ms linear forwards`,
              }}
            />
          </svg>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
            지도 보기
          </span>
        </div>
      )}

      {/* 레벨 7 이상 안내 메시지 */}
      {level >= 7 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 16px)',
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
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
            포스팅 마커가 보이지 않는 화면 입니다.
          </span>
        </div>
      )}

      {/* 마커 숨김 상태 안내 */}
      {uiState === 'hidden' && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 8px) + 16px)',
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

      {/* 부드러운 줌을 위한 CSS Transform 래퍼 */}
      <div
        ref={smoothZoomWrapperRef}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <div
          ref={containerRef}
          id="kakao-map"
          className="w-full h-full select-none"
        />
      </div>
    </div>
  );
};

export default MapContainer;