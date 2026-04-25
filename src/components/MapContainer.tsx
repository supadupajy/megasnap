"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';
import { getFallbackImage } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
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

const MapContainer = ({ 
  posts, 
  viewedPostIds, 
  highlightedPostId,
  onMarkerClick, 
  onMapChange, 
  onMapClick,
  center,
  level = 5,
  searchResultLocation,
}: MapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<number>(5);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [internalViewedIds, setInternalViewedIds] = useState<Set<string>>(new Set());

  const overlaysRef = useRef<Map<string, any>>(new Map());
  const removalTimeoutsRef = useRef<Map<string, number>>(new Map());
  const searchOverlayRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const isProgrammaticMove = useRef(false);
  const lastDragEnd = useRef(0);
  const currentLevelRef = useRef<number>(5);

  const centerRef = useRef(center);
  const levelRef = useRef(5);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { levelRef.current = level; }, [level]);

  const { user: authUser } = useAuth();

  const onMapChangeRef = useRef(onMapChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { onMapChangeRef.current = onMapChange; }, [onMapChange]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

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
          }, 500);
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

  const initMap = useCallback(() => {
    try {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.Map || !kakao?.maps?.LatLng) return false;
      if (mapInstance.current) return true;

      const initialCenter = centerRef.current || mapCache.lastCenter || { lat: 37.5665, lng: 126.9780 };
      const map = new kakao.maps.Map(containerRef.current!, {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: 5
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
        if (isProgrammaticMove.current) return;
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
          
          // ✅ 브라우저 탭 활성화 상태가 아닐 때는 업데이트 스킵하지 않도록 보장
          localStorage.setItem('map_bounds', JSON.stringify(boundsData));
          onMapChangeRef.current({
            bounds: boundsData,
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: mapLevel,
          });
        } catch (e) {}
      };

      updateMapData();
      setIsMapReady(true);
      setIsLoading(false);

      // ✅ idle 이벤트 추가하여 지도 이동이 끝난 후 확실하게 데이터 갱신
      kakao.maps.event.addListener(map, 'idle', updateMapData);
      kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
      kakao.maps.event.addListener(map, 'dragstart', () => { isDragging.current = true; setIsMapMoving(true); });
      kakao.maps.event.addListener(map, 'dragend', () => { isDragging.current = false; setIsMapMoving(false); lastDragEnd.current = Date.now(); });
      
      // ✅ 지도 클릭 시 검색 결과 마커 제거 로직 추가
      kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        // 검색 마커 제거 (상태 초기화 트리거를 위해 부모에게 알림)
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
            mapInstance.current.setLevel(5, { animate: false });
            setCurrentLevel(5);
            currentLevelRef.current = 5;
          }
        }
      }
    }, 100);
    return () => clearInterval(checkMap);
  }, [initMap]);

  useEffect(() => {
    if (mapInstance.current && level !== undefined) {
      mapInstance.current.setLevel(level);
      setCurrentLevel(level);
      currentLevelRef.current = level;
    }
  }, [level]);

  // ✅ 마커 렌더링 통합 로직 (props 변화 및 internalViewedIds 변화 모두 감지)
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;

    const bounds = mapInstance.current.getBounds();
    const currentPostIds = new Set(posts.map(p => p.id));
    const combinedViewedIds = new Set([...Array.from(viewedPostIds), ...Array.from(internalViewedIds)]);

    // Get list of IDs currently in props
    const propPostIds = new Set(posts.map(p => p.id));

    // Remove overlays that are no longer in the posts prop with animation
    overlaysRef.current.forEach((overlay, id) => {
      if (!propPostIds.has(id)) {
        const content = overlay.getContent() as HTMLElement;
        if (content && !content.classList.contains('marker-disappear-animation')) {
          content.classList.remove('marker-appear-animation');
          content.classList.add('marker-disappear-animation');
          content.style.pointerEvents = 'none';
          
          setTimeout(() => {
            // Check again if it's still missing from props before actual removal
            if (!propPostIds.has(id) && overlaysRef.current.has(id)) {
              overlay.setMap(null);
              overlaysRef.current.delete(id);
            }
          }, 450);
        } else if (!content) {
          overlay.setMap(null);
          overlaysRef.current.delete(id);
        }
      }
    });

    posts.forEach(post => {
      if (!post) return;
      const position = new kakao.maps.LatLng(post.lat, post.lng);
      if (!bounds.contain(position)) return;

      const isViewed = combinedViewedIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const isNew = !!post.isNewRealtime;
      const existingOverlay = overlaysRef.current.get(post.id);
      const contentStateKey = `${isViewed}-${post.borderType}-${post.isAd}-${isNew}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay marker-appear-animation';
        if (isHighlighted) content.classList.add('highlighted');
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        content.onclick = (e) => {
          e.stopPropagation();
          if (isDragging.current) return;
          onMarkerClickRef.current(post);
        };

        const overlay = new kakao.maps.CustomOverlay({
          position: position,
          content: content,
          zIndex: isHighlighted ? 10000 : (post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300))
        });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        if (existingOverlay.getMap() === null) {
          existingOverlay.setMap(mapInstance.current);
        }
        
        // 상태가 변했으면 HTML 업데이트
        if (content.getAttribute('data-content-state') !== contentStateKey) {
          content.innerHTML = getMarkerInnerHtml(post, isViewed);
          content.setAttribute('data-content-state', contentStateKey);
        }
      }
    });
  }, [posts, viewedPostIds, internalViewedIds, highlightedPostId, isMapReady]);

// ✅ highlight-marker 이벤트로 직접 DOM 조작 (React 리렌더링 없이)
useEffect(() => {
  const handleHighlight = (e: any) => {
    const postId = e.detail?.id;
    const duration = e.detail?.duration || 6000;

    // 모든 마커에서 highlighted 제거
    overlaysRef.current.forEach((overlay, id) => {
      const content = overlay.getContent() as HTMLElement;
      if (!content) return;
      if (content.classList.contains('highlighted')) {
        content.classList.remove('highlighted');
        // ZIndex 원복
        const post = posts.find(p => p.id === id);
        overlay.setZIndex(post?.isAd ? 500 : post?.borderType !== 'none' ? 400 : 300);
      }
    });

    if (!postId) return;

    // 해당 마커에 highlighted 추가
    const overlay = overlaysRef.current.get(postId);
    if (overlay) {
      const content = overlay.getContent() as HTMLElement;
      if (content) {
        // 기존 상태 초기화
        content.classList.remove('highlighted');
        void content.offsetWidth; 
        
        content.classList.add('highlighted');
        overlay.setZIndex(99999);

        // 핑 효과 3번 (0.8s * 3 = 2.4s) 이후 원복
        setTimeout(() => {
          if (content.classList.contains('highlighted')) {
            content.classList.remove('highlighted');
            const post = posts.find(p => p.id === postId);
            overlay.setZIndex(post?.isAd ? 500 : post?.borderType !== 'none' ? 400 : 300);
          }
        }, 2500);
      }
    }
  };

  window.addEventListener('highlight-marker', handleHighlight);
  return () => window.removeEventListener('highlight-marker', handleHighlight);
}, [posts]);

  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    const map = mapInstance.current;
    const kakao = (window as any).kakao;

    const handleZoom = () => {
      const level = map.getLevel();
      let scale = 1.0;
      if (level === 6) scale = 0.7;
      else if (level === 7) scale = 0.45;
      else if (level >= 8) scale = 0;

      // REMOVED: manual scale adjustment here. 
      // We rely on CSS classes (zoom-X) added to the map container.
      const el = containerRef.current;
      if (el) {
        el.className = el.className.replace(/\bzoom-\d+\b/g, '');
        el.classList.add(`zoom-${level}`);
      }
    };

    kakao.maps.event.addListener(map, 'zoom_changed', handleZoom);
    return () => kakao.maps.event.removeListener(map, 'zoom_changed', handleZoom);
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

  const smoothMoveTo = (targetLat: number, targetLng: number) => {
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!map || !kakao || !kakao.maps?.LatLng) return;

    if (window.getSelection) window.getSelection()?.removeAllRanges();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const startCenter = map.getCenter();
    const startLat = startCenter.getLat();
    const startLng = startCenter.getLng();
    const dist = Math.sqrt(Math.pow(targetLat - startLat, 2) + Math.pow(targetLng - startLng, 2));
    const duration = Math.min(Math.max(dist * 800, 600), 1200);
    const startTime = performance.now();

    isProgrammaticMove.current = true;

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
        isProgrammaticMove.current = false;
        animationFrameRef.current = null;
        try {
          const bounds = map.getBounds();
          const mapLevel = map.getLevel();
          onMapChangeRef.current({
            bounds: {
              sw: { lat: bounds.getSouthWest().getLat(), lng: bounds.getSouthWest().getLng() },
              ne: { lat: bounds.getNorthEast().getLat(), lng: bounds.getNorthEast().getLng() }
            },
            center: { lat: targetLat, lng: targetLng },
            level: mapLevel
          });
        } catch (e) {}
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isMapReady && mapInstance.current && center) {
      const currentCenter = mapInstance.current.getCenter();
      const latDiff = Math.abs(currentCenter.getLat() - center.lat);
      const lngDiff = Math.abs(currentCenter.getLng() - center.lng);
      if (latDiff > 0.00001 || lngDiff > 0.00001) smoothMoveTo(center.lat, center.lng);
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
    const isAd = post.isAd;
    const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
    const hasVideo = !!post.videoUrl || !!post.youtubeUrl;

    const isBrokenUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return true;
      if (url.includes('source.unsplash.com') || url.length < 50) return true;
      for (const id of BROKEN_UNSPLASH_IDS) {
        if (url.includes(id)) return true;
      }
      return false;
    };

    // ✅ [FIX] 동영상 포스트인 경우, 썸네일 대신 실제 비디오 URL을 사용하여 브라우저가 첫 프레임을 보여줄 수 있게 함
    let displayImage = post.image;
    const isVideo = !!post.videoUrl || !!post.youtubeUrl;

    if (isVideo && post.videoUrl) {
      // 일반 비디오 파일인 경우 비디오 URL 자체를 사용하여 <img> 태그의 에러를 방지하고 처리
      displayImage = post.videoUrl;
    } else if (displayImage && (displayImage.includes('unsplash.com') || displayImage.includes('photo-1501785888041-af3ef285b470'))) {
      displayImage = getFallbackImage(String(post.id));
    }
    
    if (isBrokenUrl(displayImage) && !isVideo) {
      displayImage = getFallbackImage(String(post.id));
    }

    let borderType = post.borderType || 'none';
    let pinColor = ''; let labelText = ''; let labelBg = ''; let labelColor = 'white';
    if (isMine) { pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; }
    else if (isAd) { pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; }
    else if (borderType === 'popular') { pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; }
    else if (borderType === 'diamond') { pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; }
    else if (borderType === 'gold') { pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = labelText ? `<div style="width: 100%; background: ${labelBg}; color: ${labelColor}; font-size: 9px; font-weight: 900; padding: 2px 0 16px 0; border-radius: 14px 14px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -16px; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.1); line-height: 1.2;">${labelText}</div>` : '';

    const isInfluencer = ['gold', 'diamond'].includes(borderType);
    const isPopular = borderType === 'popular';
    let animationClass = '';
    if (isAd) animationClass = 'animate-ad-breathing';
    else if (isInfluencer || isPopular) animationClass = 'animate-marker-float';

    const isSpecialPost = isMine || isAd || borderType !== 'none';
    const shineClass = isSpecialPost ? 'shine-overlay' : '';

    let inlineBorderStyle = "border: 3px solid #ffffff;";
    let inlineShadow = "0 6px 16px rgba(0, 0, 0, 0.12)";
    let influencerClass = "";

    if (isMine) { inlineBorderStyle = "border: 4.5px solid #4f46e5;"; inlineShadow = "0 0 15px rgba(79, 70, 229, 0.4)"; }
    else if (isAd) { inlineBorderStyle = "border: 4.5px solid #3b82f6;"; inlineShadow = "0 0 15px rgba(59, 130, 246, 0.4)"; }
    else if (borderType === 'popular') { inlineBorderStyle = "border: 4.5px solid #ef4444;"; inlineShadow = "0 0 20px rgba(239, 68, 68, 0.5)"; }
    else if (borderType === 'diamond') { inlineBorderStyle = "border: 4.5px solid #22d3ee;"; inlineShadow = "0 0 20px rgba(34, 211, 238, 0.8), inset 0 0 10px rgba(34, 211, 238, 0.5)"; influencerClass = "influencer-glow"; }
    else if (borderType === 'gold') { inlineBorderStyle = "border: 4.5px solid #fbbf24;"; inlineShadow = "0 0 20px rgba(251, 191, 36, 0.6), inset 0 0 10px rgba(251, 191, 36, 0.4)"; influencerClass = "influencer-glow"; }

    return `<div class="marker-content-wrapper">
      <div class="marker-highlight-ping"></div>
      <div class="${animationClass} marker-scaling-target" style="display: flex; flex-direction: column; align-items: center; width: 60px;">
        ${labelHtml}
        <div class="${influencerClass}" style="width: 60px; height: 60px; border-radius: 20px; position: relative; z-index: 2; ${inlineBorderStyle} overflow: hidden; box-shadow: ${inlineShadow}; background-color: white; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: 100%; overflow: hidden; position: relative;" class="${shineClass}">
            ${isVideo && post.videoUrl ? 
              `<video src="${displayImage}#t=0.1" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; ${isViewed ? 'filter: grayscale(1) brightness(0.4) contrast(1.2); opacity: 0.9;' : ''}"></video>` : 
              `<img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.4) contrast(1.2); opacity: 0.9;' : ''}" />`
            }
            <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 6px; z-index: 5; border: 1px solid rgba(255,255,255,0.2); line-height: 1; ${isViewed ? 'background: rgba(40,40,40,0.9); color: rgba(255,255,255,0.5);' : ''}">
              ${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}
            </div>
            ${videoIconHtml}
          </div>
        </div>
      </div>
    </div>`;
  };

  const cancelPendingRemoval = (id: string, content?: HTMLElement | null) => {
    const timeoutId = removalTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      removalTimeoutsRef.current.delete(id);
    }
    if (content) {
      content.classList.remove('animate-marker-disappear');
      content.style.opacity = "1";
      content.style.visibility = "visible";
    }
  };

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
      <div
        ref={containerRef}
        id="kakao-map"
        className="w-full h-full select-none"
      />
    </div>
  );
};

export default MapContainer;