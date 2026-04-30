"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';
import { getFallbackImage } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
  level?: number;
  searchResultLocation?: { lat: number; lng: number } | null;
}

const FALLBACK_IMAGE = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";

const BROKEN_UNSPLASH_IDS = new Set([
  "photo-1548199973-03cbf5292374",
  "photo-1501785888041-af3ef285b470",
]);

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
  const highlightingIdsRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const lastDragEnd = useRef(0);
  const currentLevelRef = useRef<number>(6);
  const postsRef = useRef<any[]>(posts);
  const viewedPostIdsRef = useRef<Set<any>>(viewedPostIds);
  const internalViewedIdsRef = useRef<Set<string>>(new Set());

  const pinchStartDistRef = useRef<number | null>(null);

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
        // markers-revealing은 제거하지 않음 → 클래스가 남아있어도 opacity:1 !important 유지
        // 깜빡임 원인: transitionend 후 클래스 제거 시 브라우저 재계산 순간 flicker 발생
        // 해결: revealing 클래스를 영구적으로 유지하고, 다음 숨김 시 hideAllMarkersDom에서 제거
        content.classList.remove('markers-hidden');
        content.classList.add('markers-revealing');
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

  useEffect(() => {
    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      const el = containerRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      if (e.touches.length === 2) {
        pinchStartDistRef.current = getDistance(e.touches);
      } else {
        pinchStartDistRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const el = containerRef.current;
      if (!el || !el.contains(e.target as Node)) return;
      if (e.touches.length !== 2 || pinchStartDistRef.current === null) return;
      const map = mapInstance.current;
      if (!map) return;

      const level = map.getLevel();
      if (level <= 4) {
        const currentDist = getDistance(e.touches);
        if (currentDist > pinchStartDistRef.current) {
          e.preventDefault();
          e.stopPropagation();
          pinchStartDistRef.current = currentDist;
        }
      }
    };

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true } as any);
      document.removeEventListener('touchmove', onTouchMove, { capture: true } as any);
    };
  }, []);

  const initMap = useCallback(() => {
    try {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.Map || !kakao?.maps?.LatLng) return false;
      if (mapInstance.current) return true;

      const initialCenter = centerRef.current || mapCache.lastCenter || { lat: 37.5665, lng: 126.9780 };
      const map = new kakao.maps.Map(containerRef.current!, {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: 6
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

      const updateMapData = () => {
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

      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.relayout();
          const currentCenter = mapInstance.current.getCenter();
          mapInstance.current.setCenter(currentCenter);
          updateZoomClass();

          const bounds = mapInstance.current.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const mapLevel = mapInstance.current.getLevel();

          onMapChangeRef.current({
            bounds: {
              sw: { lat: sw.getLat(), lng: sw.getLng() },
              ne: { lat: ne.getLat(), lng: ne.getLng() }
            },
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: mapLevel,
          });
        }
      }, 200);

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
            mapInstance.current.setLevel(6, { animate: false });
            setCurrentLevel(6);
            currentLevelRef.current = 6;
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
      
      const isSeed = post.is_seed_data === true || post.is_seed_data === 'true' || post.is_seed_data === 1;
      // [FIX] isMineKey: 시드 데이터는 display_user_id 기준, 일반 포스팅은 owner_id/user_id 기준
      let isMineKey = false;
      if (authUser) {
        if (!isSeed) {
          const ownerId = (post as any).owner_id || (post as any).user_id;
          isMineKey = !!(ownerId && String(ownerId) === String(authUser.id));
        } else {
          const displayId = (post as any).display_user_id;
          isMineKey = !!(displayId && String(displayId) === String(authUser.id));
        }
      }
      const isAdPendingKey = !!(post as any).isAdPending;
      const contentStateKey = `${isViewed}-${post.borderType}-${post.isAd}-${isNew}-${isSeed}-${isMineKey}-${isAdPendingKey}`;

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
          zIndex: post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300)
        });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        if (existingOverlay.getMap() === null) {
          existingOverlay.setMap(mapInstance.current);
        }
        
        if (content.getAttribute('data-content-state') !== contentStateKey) {
          if (!highlightingIdsRef.current.has(post.id)) {
            content.innerHTML = getMarkerInnerHtml(post, isViewed);
            content.setAttribute('data-content-state', contentStateKey);
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
      const isSeed = p.is_seed_data === true || p.is_seed_data === 'true' || p.is_seed_data === 1;
      // [FIX] isMineKey: 시드 데이터는 display_user_id 기준, 일반 포스팅은 owner_id/user_id 기준
      let isMineKey = false;
      if (authUserRef.current) {
        if (!isSeed) {
          const ownerId = (p as any).owner_id || (p as any).user_id;
          isMineKey = !!(ownerId && String(ownerId) === String(authUserRef.current.id));
        } else {
          const displayId = (p as any).display_user_id;
          isMineKey = !!(displayId && String(displayId) === String(authUserRef.current.id));
        }
      }
      const isAdPendingKey = !!(p as any).isAdPending;
      const newStateKey = `${isViewed}-${p.borderType}-${p.isAd}-${!!p.isNewRealtime}-${isSeed}-${isMineKey}-${isAdPendingKey}`;
      content.innerHTML = getMarkerInnerHtmlRef.current(p, isViewed);
      content.setAttribute('data-content-state', newStateKey);
    });
  }, [viewedPostIds, internalViewedIds, isMapReady]);

  useEffect(() => {
    const handleHighlight = (e: any) => {
      const postId = e.detail?.id;
      const duration = e.detail?.duration || 2500;

      if (!postId) return;

      const tryHighlight = (retryCount = 0) => {
        const overlay = overlaysRef.current.get(postId);
        
        if (overlay) {
          const content = overlay.getContent() as HTMLElement;
          if (content) {
            overlaysRef.current.forEach((o, id) => {
              const c = o.getContent() as HTMLElement;
              if (c && c.classList.contains('highlighted') && id !== postId) {
                c.classList.remove('highlighted');
                c.classList.remove('marker-appear-animation');
                highlightingIdsRef.current.delete(id);
                const p = postsRef.current.find(item => item.id === id);
                if (p) {
                  // [FIX] 동영상 마커는 innerHTML 교체 시 <video>가 재로드되어 깜빡임 발생.
                  // 동영상 마커는 innerHTML 교체를 생략하고 클래스 제거만 수행.
                  const isVideoMarker = !!(p as any).videoUrl || (
                    !p.isAd && typeof (p as any).image === 'string' &&
                    (() => {
                      const lower = ((p as any).image as string).toLowerCase().split('?')[0];
                      return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v');
                    })()
                  );
                  if (!isVideoMarker) {
                    const stateKey = c.getAttribute('data-content-state') || '';
                    const isViewed = stateKey.startsWith('true');
                    c.innerHTML = getMarkerInnerHtmlRef.current(p, isViewed);
                  }
                }
                o.setZIndex(
                  postsRef.current.find(item => item.id === id)?.isAd ? 500 :
                  (postsRef.current.find(item => item.id === id)?.borderType !== 'none' ? 400 : 300)
                );
              }
            });

            content.classList.remove('highlighted');
            void content.offsetWidth;
            content.classList.add('highlighted');
            highlightingIdsRef.current.add(postId);
            overlay.setZIndex(99999);

            setTimeout(() => {
              if (!content || !content.classList.contains('highlighted')) {
                highlightingIdsRef.current.delete(postId);
                return;
              }
              content.classList.remove('highlighted');
              content.classList.remove('marker-appear-animation');

              const p = postsRef.current.find(item => item.id === postId);
              if (p) {
                const combinedViewed = new Set([
                  ...Array.from(viewedPostIdsRef.current),
                  ...Array.from(internalViewedIdsRef.current)
                ]);
                const isViewed = combinedViewed.has(postId);
                const isSeed = p.is_seed_data === true || (p.is_seed_data as any) === 'true' || (p.is_seed_data as any) === 1;
                const currentAuthUser = authUserRef.current;
                let isMineKey = false;
                if (currentAuthUser) {
                  if (!isSeed) {
                    const ownerId = (p as any).owner_id || (p as any).user_id;
                    isMineKey = !!(ownerId && String(ownerId) === String(currentAuthUser.id));
                  } else {
                    const displayId = (p as any).display_user_id;
                    isMineKey = !!(displayId && String(displayId) === String(currentAuthUser.id));
                  }
                }
                const isAdPendingKey = !!(p as any).isAdPending;
                const newStateKey = `${isViewed}-${p.borderType}-${p.isAd}-${!!p.isNewRealtime}-${isSeed}-${isMineKey}-${isAdPendingKey}`;

                // [FIX] 동영상 마커는 innerHTML 교체 시 <video>가 재로드되어 깜빡임 발생.
                // 상태 변경이 없으면 innerHTML 교체를 완전히 생략하고 data-content-state만 갱신.
                // 상태 변경이 있더라도 동영상 마커는 <video> 요소를 재사용하고 나머지만 교체.
                const prevStateKey = content.getAttribute('data-content-state') || '';
                const isVideoMarker = !!(p as any).videoUrl || (
                  !p.isAd && typeof (p as any).image === 'string' &&
                  (() => {
                    const lower = ((p as any).image as string).toLowerCase().split('?')[0];
                    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v');
                  })()
                );

                if (prevStateKey !== newStateKey) {
                  if (isVideoMarker) {
                    // 동영상 마커: <video> 요소를 보존하고 상태만 업데이트
                    // innerHTML 교체 없이 data-content-state만 갱신 (깜빡임 방지)
                    content.setAttribute('data-content-state', newStateKey);
                  } else {
                    content.innerHTML = getMarkerInnerHtmlRef.current(p, isViewed);
                    content.setAttribute('data-content-state', newStateKey);
                  }
                }
                // 상태 변경 없으면 아무것도 하지 않음 (innerHTML 교체 생략)
              }
              highlightingIdsRef.current.delete(postId);

              const p2 = postsRef.current.find(item => item.id === postId);
              overlay.setZIndex(p2?.isAd ? 500 : p2?.borderType !== 'none' ? 400 : 300);
            }, duration);
            return;
          }
        }

        if (retryCount < 15) {
          setTimeout(() => tryHighlight(retryCount + 1), 200);
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

    const MIN_LEVEL = 4;
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

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || level === undefined) return;
    const timer = setTimeout(() => {
      const map = mapInstance.current;
      if (!map) return;
      map.setLevel(level, { animate: false });
      const newLevel = map.getLevel();
      setCurrentLevel(newLevel);
      currentLevelRef.current = newLevel;
    }, 300);
    return () => clearTimeout(timer);
  }, [level, isMapReady]);

  const smoothMoveTo = (targetLat: number, targetLng: number, onComplete?: () => void) => {
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!map || !kakao || !kakao.maps?.LatLng) return;

    if (window.getSelection) window.getSelection()?.removeAllRanges();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const startCenter = map.getCenter();
    const startLat = startCenter.getLat();
    const startLng = startCenter.getLng();
    const dist = Math.sqrt(Math.pow(targetLat - startLat, 2) + Math.pow(targetLng - startLng, 2));
    const duration = Math.min(Math.max(dist * 500, 400), 800);
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
        onComplete?.();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isMapReady && mapInstance.current && center) {
      const currentCenter = mapInstance.current.getCenter();
      const latDiff = Math.abs(currentCenter.getLat() - center.lat);
      const lngDiff = Math.abs(currentCenter.getLng() - center.lng);
      if (latDiff > 0.00001 || lngDiff > 0.00001) {
        smoothMoveTo(center.lat, center.lng, () => {
          window.dispatchEvent(new CustomEvent('map-move-complete', { detail: { lat: center.lat, lng: center.lng } }));
        });
      } else {
        window.dispatchEvent(new CustomEvent('map-move-complete', { detail: { lat: center.lat, lng: center.lng } }));
      }
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

  const getMarkerInnerHtml = (post: any, isViewed: boolean) => {
    const isAd = post.isAd || (post.content && post.content.includes('[AD]'));
    const isAdPending = !!(post as any).isAdPending;
    const isSeed = post.is_seed_data === true || post.is_seed_data === 'true' || post.is_seed_data === 1;
    
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

    let isMine = false;
    const currentUser = authUserRef.current;
    if (currentUser) {
      // [FIX] 시드 데이터는 user_id가 현재 사용자 ID이지만 실제로는 다른 사람 포스팅
      // owner_id(실제 소유자)를 우선 사용하되, 시드 데이터는 display_user_id가 없거나
      // display_user_id가 현재 사용자와 다르면 MY 표시 안 함
      if (!isSeed) {
        // 일반 포스팅: user_id 또는 owner_id로 판별
        const ownerId = post.owner_id || post.user_id;
        if (ownerId && String(ownerId) === String(currentUser.id)) isMine = true;
      } else {
        // 시드 데이터: display_user_id가 현재 사용자 ID인 경우에만 MY
        // (display_user_id가 null이거나 다른 사람이면 MY 아님)
        const displayId = post.display_user_id;
        if (displayId && String(displayId) === String(currentUser.id)) isMine = true;
        // display_user_id가 없으면 MY 표시 안 함 (랜덤 닉네임 풀에서 생성된 경우)
      }
    }
                   
    // [AD 보정] 광고는 절대 비디오/유튜브로 표시하지 않음
    const hasVideo = !isAd && (!!post.videoUrl || !!post.youtubeUrl);

    const isBrokenUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return true;
      if (url.includes('source.unsplash.com') || url.length < 50) return true;
      for (const id of BROKEN_UNSPLASH_IDS) {
        if (url.includes(id)) return true;
      }
      return false;
    };

    let displayImage = post.image;
    const isVideo = !isAd && (!!post.videoUrl || !!post.youtubeUrl);

    // 광고이고 image가 유튜브 썸네일이면 안정적인 음식 이미지로 대체
    if (isAd && typeof displayImage === 'string' && displayImage.includes('img.youtube.com')) {
      displayImage = getFallbackImage(`ad:${post.id}`);
    }

    if (isVideo && post.videoUrl) {
      displayImage = post.videoUrl;
    } else if (displayImage && (displayImage.includes('unsplash.com') || displayImage.includes('photo-1501785888041-af3ef285b470'))) {
      displayImage = getFallbackImage(String(post.id));
    }

    if (isBrokenUrl(displayImage) && !isVideo) {
      displayImage = getFallbackImage(String(post.id));
    }

    let borderType = post.borderType || 'none';
    let labelText = ''; let labelBg = ''; let labelColor = 'white';
    if (isMine) { labelText = 'MY'; labelBg = '#4f46e5'; }
    else if (isAd) { labelText = 'AD'; labelBg = 'ad-rainbow'; }
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

    const innerBoxStyle = `width:60px;height:60px;border-radius:20px;position:relative;z-index:2;${inlineBorderStyle}box-shadow:${inlineShadow};background-color:white;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:visible;`;

    // AD 마커: 라벨+이미지 박스를 하나의 wrapper로 감싸서 함께 회전
    const adFlipWrapperStart = isAd
      ? `<div style="display:flex;flex-direction:column;align-items:center;width:60px;animation:_ad_flip 4s ease-in-out infinite;transform-style:preserve-3d;">`
      : '';
    const adFlipWrapperEnd = isAd ? `</div>` : '';

    return `${adStyleTag}<div class="marker-content-wrapper">
      <div class="marker-highlight-ping"></div>
      <div class="${animationClass} marker-scaling-target" style="display:flex;flex-direction:column;align-items:center;width:60px;position:relative;">
        ${isAd ? adGlowLayer : ''}
        ${isAd ? adFlipWrapperStart : ''}
        ${isAd ? adLabelHtml : labelHtml}
        <div class="${influencerClass}" style="${innerBoxStyle}">
          ${isAd ? adSparklesHtml : ''}
          <div style="width:100%;height:100%;overflow:hidden;position:relative;border-radius:${isAd ? '15px' : '16px'};" class="${shineClass}">
            ${isVideo && post.videoUrl ?
              `<video src="${displayImage}#t=0.1" style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>` :
              `<img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width:100%;height:100%;object-fit:cover;" />`
            }
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

      <div
        ref={containerRef}
        id="kakao-map"
        className="w-full h-full select-none"
      />
    </div>
  );
};

export default MapContainer;