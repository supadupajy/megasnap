"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';
import { mapCache } from '@/utils/map-cache';

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

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const MapContainer = ({ 
  posts, 
  viewedPostIds, 
  highlightedPostId,
  onMarkerClick, 
  onMapChange, 
  onMapClick,
  center,
  level = 5,
  searchResultLocation
}: MapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<number>(5);
  const [isMapMoving, setIsMapMoving] = useState(false);
  
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const removalTimeoutsRef = useRef<Map<string, number>>(new Map());
  const searchOverlayRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const isProgrammaticMove = useRef(false);
  const lastDragEnd = useRef(0);
  const currentLevelRef = useRef<number>(5);

  // ✅ [핵심 FIX] center/level을 ref로 관리
  // initMap의 deps를 비워서 "props 변경 → initMap 재생성 → setInterval 재실행 → 지도 재초기화" 루프를 차단
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

  // IndexSizeError 차단 (브라우저 확장 프로그램 대응)
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

  // ✅ [핵심 FIX] deps 배열 완전 제거 → 이 함수는 컴포넌트 생애주기 동안 절대 재생성되지 않음
  const initMap = useCallback(() => {
    try {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.Map || !kakao?.maps?.LatLng) return false;

      // ✅ [핵심 FIX] 이미 초기화된 경우 즉시 true 반환 — 재초기화 완전 방지
      if (mapInstance.current) return true;

      // ✅ 캐시된 lastZoom 무시하고 무조건 5단계로 시작하도록 우선순위 조정
      const initialCenter = centerRef.current || mapCache.lastCenter || { lat: 37.5665, lng: 126.9780 };
      const initialLevel = 5; 

      const options = {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: initialLevel
      };

      const map = new kakao.maps.Map(containerRef.current!, options);
      map.setMaxLevel(11);
      mapInstance.current = map;

      const updateMapData = () => {
        if (isProgrammaticMove.current) return;
        try {
          const bounds = map.getBounds();
          const currentCenter = map.getCenter();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const mapLevel = map.getLevel();
          
          setCurrentLevel(mapLevel);
          currentLevelRef.current = mapLevel;

          // ✅ [핵심 FIX] 부모(Index.tsx)로 지도 영역 정보를 전달할 때 
          // 현재 화면에 실제로 보이는 마커들의 기반이 되는 bounds 정보를 정확히 전달
          onMapChangeRef.current({
            bounds: { 
              sw: { lat: sw.getLat(), lng: sw.getLng() }, 
              ne: { lat: ne.getLat(), lng: ne.getLng() } 
            },
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: mapLevel,
            // 추가로 현재 카운트를 직접 계산해서 보낼 수도 있지만, Index.tsx의 필터 로직이 중요함
          });
        } catch (e) {
          console.error('Map update error:', e);
        }
      };

      updateMapData();
      setIsMapReady(true);
      setIsLoading(false);

      kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);

      kakao.maps.event.addListener(map, 'dragstart', () => { 
        isDragging.current = true; 
        setIsMapMoving(true);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          isProgrammaticMove.current = false;
        }
      });
      kakao.maps.event.addListener(map, 'dragend', () => { 
        isDragging.current = false; 
        setIsMapMoving(false);
        lastDragEnd.current = Date.now(); 
      });

      kakao.maps.event.addListener(map, 'zoom_start', () => setIsMapMoving(true));

      kakao.maps.event.addListener(map, 'zoom_changed', () => {
        const newLevel = map.getLevel();
        setCurrentLevel(newLevel);
        currentLevelRef.current = newLevel;
        
        // ✅ [긴급 수정] 8단계 이상이면 즉시 모든 오버레이를 지도에서 제거
        if (newLevel >= 8) {
          overlaysRef.current.forEach((overlay) => {
            overlay.setMap(null);
          });
          // Note: overlaysRef는 useEffect 내의 동기화를 위해 clear() 하지 않고 유지
        }
      });

      kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        if (Date.now() - lastDragEnd.current < 200) return;
        if (onMapClickRef.current) {
          const latLng = mouseEvent.latLng;
          onMapClickRef.current({ lat: latLng.getLat(), lng: latLng.getLng() });
        }
      });

      return true;
    } catch (e) {
      console.error('Kakao Map Init Error:', e);
      return false;
    }
  }, []); // ✅ 의존성 없음 — 생애 동안 1회만 생성

  // 초기 지도 로딩 및 레벨 감시
  useEffect(() => {
    const checkMap = setInterval(() => {
      if ((window as any).kakao?.maps) {
        const isInit = initMap();
        if (isInit) {
          clearInterval(checkMap);
          // ✅ 초기 시작 시 무조건 5단계로 세팅 (다른 캐시 무시)
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

  // 외부 level prop 변경 감시
  useEffect(() => {
    if (mapInstance.current && level !== undefined) {
      // ✅ 외부 level prop이 들어올 때만 변경하되, 초기 마운트 시에는 5를 유지하도록
      mapInstance.current.setLevel(level);
      setCurrentLevel(level);
      currentLevelRef.current = level;
    }
  }, [level]);

  // 마커 크기 계산 (level에 따른 scale)
  const getMarkerScale = (lvl: number) => {
    if (lvl <= 5) return 1;     // 5단계 이하: 100%
    if (lvl === 6) return 0.75;  // 6단계: 75%
    if (lvl === 7) return 0.5;   // 7단계: 50%
    return 0;                    // 8단계 이상: 숨김
  };

  // 마커 업데이트 로직
  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;
    
    const level = mapInstance.current.getLevel();
    let scale = 1.0;
    if (level === 6) scale = 0.75;
    else if (level === 7) scale = 0.5;
    else if (level >= 8) scale = 0;
    
    // 8단계 이상이면 무조건 모든 오버레이 제거
    if (level >= 8) {
      overlaysRef.current.forEach((overlay) => {
        const content = overlay.getContent();
        if (content instanceof HTMLElement) {
          content.style.opacity = '0';
          content.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => overlay.setMap(null), 300);
        } else {
          overlay.setMap(null);
        }
      });
      return;
    }

    const bounds = mapInstance.current.getBounds();
    const currentPostIds = new Set(posts.map(p => p.id));
    
    // 1. 제거될 마커 처리 (Fade Out)
    overlaysRef.current.forEach((overlay, id) => {
      const content = overlay.getContent();
      const position = overlay.getPosition();
      
      // ✅ 현재 화면(bounds) 밖에 있거나, 게시물 목록에 없는 경우 제거
      if (!currentPostIds.has(id) || !bounds.contain(position)) {
        if (content instanceof HTMLElement) {
          content.style.opacity = '0';
          content.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            // 체크 시점에 여전히 화면 밖이거나 삭제된 상태면 실제 제거
            if (!currentPostIds.has(id) || !bounds.contain(position)) {
              overlay.setMap(null);
              overlaysRef.current.delete(id);
            }
          }, 300);
        } else {
          overlay.setMap(null);
          overlaysRef.current.delete(id);
        }
      } else {
        // 화면 안에 있으면 다시 지도에 부착 (필요 시)
        if (overlay.getMap() === null) {
          overlay.setMap(mapInstance.current);
          if (content instanceof HTMLElement) {
            content.style.opacity = '0';
            requestAnimationFrame(() => {
              content.style.transition = 'opacity 0.3s ease-out, transform 0.2s ease-out';
              content.style.opacity = '1';
            });
          }
        }
        if (content instanceof HTMLElement) {
          content.style.transformOrigin = 'bottom center';
          content.style.setProperty('transform', `scale(${scale})`, 'important');
        }
      }
    });

    // 2. 마커 생성 및 업데이트 (화면 안에 있는 것만)
    posts.forEach(post => {
      if (!post) return;
      
      const position = new (window as any).kakao.maps.LatLng(post.lat, post.lng);
      
      // ✅ 마커 생성 전, 현재 화면(bounds) 안에 있는지 엄격히 검사
      if (!bounds.contain(position)) {
        return;
      }

      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const existingOverlay = overlaysRef.current.get(post.id);
      
      const baseZIndex = isHighlighted ? 10000 : (post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300));
      const contentStateKey = `${post.likes}-${isViewed}-${post.image}-${level}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay';
        
        // 기존 팝업 애니메이션 대신 Fade In 효과 적용
        content.style.opacity = '0';
        content.style.transition = 'opacity 0.3s ease-out, transform 0.2s ease-out';
        content.style.transformOrigin = 'bottom center';
        content.style.setProperty('transform', `scale(${scale})`, 'important');

        if (isHighlighted) content.classList.add('highlighted');
        
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        
        content.onclick = (e) => { 
          e.stopPropagation(); 
          if (isDragging.current || (Date.now() - lastDragEnd.current < 200)) return; 
          if (onMarkerClickRef.current) onMarkerClickRef.current(post); 
        };

        const overlay = new (window as any).kakao.maps.CustomOverlay({ 
          position: new (window as any).kakao.maps.LatLng(post.lat, post.lng), 
          content: content, 
          yAnchor: 1, 
          zIndex: baseZIndex 
        });
        
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);

        // 생성 직후 투명도를 1로 올려서 Fade In
        requestAnimationFrame(() => {
          content.style.opacity = '1';
        });
      } else {
        const content = existingOverlay.getContent();
        existingOverlay.setZIndex(baseZIndex);
        if (content instanceof HTMLElement) {
          cancelPendingRemoval(post.id, content);
          
          content.style.transformOrigin = 'bottom center';
          content.style.setProperty('transform', `scale(${scale})`, 'important');
          content.style.opacity = "1";
          content.style.visibility = "visible";
          
          if (isHighlighted) content.classList.add('highlighted'); 
          else content.classList.remove('highlighted');

          if (content.getAttribute('data-content-state') !== contentStateKey) {
            requestAnimationFrame(() => { 
              content.innerHTML = getMarkerInnerHtml(post, isViewed); 
              content.setAttribute('data-content-state', contentStateKey); 
            });
          }
        }
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, authUser, currentLevel]);

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

    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }

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
          <div class="relative w-12 h-12">
            <div class="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl"></div>
            <div class="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10"></div>
          </div>
        </div>
      `;

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(searchResultLocation.lat, searchResultLocation.lng),
        content: content,
        yAnchor: 1,
        zIndex: 11000 
      });

      overlay.setMap(mapInstance.current);
      searchOverlayRef.current = overlay;
    }
  }, [searchResultLocation, isMapReady]);

  const getMarkerInnerHtml = (post: any, isViewed: boolean) => {
    const isAd = post.isAd;
    const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
    const borderType = post.borderType || 'none';
    const hasVideo = !!post.videoUrl || !!post.youtubeUrl;
    
    // [FIX] 지도 마커 이미지 깨짐 방지: Profile.tsx에서 사용한 것과 동일한 검증 로직 적용
    const isBrokenUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return true;
      return url.includes('images.unsplash.com') && (url.includes('source.unsplash.com') || url.length < 50);
    };

    let displayImage = post.image;
    if (isBrokenUrl(displayImage)) {
      displayImage = `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=${post.id}`;
    }

    let pinColor = ''; let labelText = ''; let labelBg = ''; let labelColor = 'white'; let borderClass = '';
    if (isMine) { pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container'; }
    else if (isAd) { pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container'; }
    else if (borderType === 'popular') { pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container'; }
    else if (borderType === 'diamond') { pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; borderClass = 'diamond-border-container'; }
    else if (borderType === 'gold') { pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; borderClass = 'gold-border-container'; }
    else if (borderType === 'silver') { pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    
    // 라벨 디자인 개선: 그림자 및 폰트 강조
    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 8px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.1);">${labelText}</div>` : '';
    
    // 내부 floating 애니메이션
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) && !isMine ? 'animate-marker-float' : '');

    // 마커 박스 그림자 및 둥근 모서리 강조
    return `<div class="marker-content-wrapper"><div class="marker-highlight-ping"></div><div class="${animationClass}">${labelHtml}<div class="${borderClass || ''}" style="width: 56px; height: 56px; border-radius: 18px; position: relative; z-index: 2; ${borderClass ? '' : `border: 2.5px solid #ffffff;`} overflow: hidden; box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.15), 0 4px 8px -2px rgba(0, 0, 0, 0.1); background-color: white;"><div style="width: 100%; height: 100%; border-radius: 14px; overflow: hidden; position: relative;" class="shine-overlay"><img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(0.8) brightness(0.7);' : ''}" /><div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); backdrop-blur: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 6px; z-index: 5; border: 1px solid rgba(255,255,255,0.2);">${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}</div>${videoIconHtml}</div></div>${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 18px; height: 14px; z-index: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"><svg width="18" height="14" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}</div></div>`;
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
      {/* ✅ [FIX] ref를 카카오맵이 실제 마운트되는 div에 직접 부착 */}
      <div 
        ref={containerRef}
        id="kakao-map" 
        className="w-full h-full select-none" 
      />
    </div>
  );
};

export default MapContainer;