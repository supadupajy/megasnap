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

          onMapChangeRef.current({
            bounds: { 
              sw: { lat: sw.getLat(), lng: sw.getLng() }, 
              ne: { lat: ne.getLat(), lng: ne.getLng() } 
            },
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: mapLevel,
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
        
        if (newLevel >= 8) {
          overlaysRef.current.forEach((overlay) => {
            overlay.setMap(null);
          });
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

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;
    
    const level = mapInstance.current.getLevel();
    let scale = 1.0;
    if (level === 6) scale = 0.75;
    else if (level === 7) scale = 0.5;
    else if (level >= 8) scale = 0;
    
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
    
    // [FIX] 줌 레벨에 따른 스케일링 로직 최적화 (해상도 저하 방지)
    // 브라우저의 래스터화 문제를 해결하기 위해 scale 대신 가능한 경우 크기 조정을 검토하거나
    // scale 사용 시 will-change: transform을 통해 GPU 가속을 유도합니다.
    overlaysRef.current.forEach((overlay, id) => {
      const content = overlay.getContent();
      const position = overlay.getPosition();
      
      if (!currentPostIds.has(id) || !bounds.contain(position)) {
        if (content instanceof HTMLElement) {
          content.style.opacity = '0';
          content.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
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
          // will-change 추가로 줌 변경 시 렌더링 품질 유지
          content.style.willChange = 'transform, opacity';
          content.style.setProperty('transform', `scale(${scale})`, 'important');
        }
      }
    });

    posts.forEach(post => {
      if (!post) return;
      
      const position = new (window as any).kakao.maps.LatLng(post.lat, post.lng);
      
      if (!bounds.contain(position)) {
        return;
      }

      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const existingOverlay = overlaysRef.current.get(post.id);
      
      const baseZIndex = isHighlighted ? 10000 : (post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300));
      
      const contentStateKey = `${post.likes}-${isViewed}-${post.image}-${level}-${post.borderType}-${post.isAd}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay';
        
        content.style.opacity = '0';
        content.style.transition = 'opacity 0.3s ease-out, transform 0.2s ease-out';
        content.style.transformOrigin = 'bottom center';
        content.style.willChange = 'transform, opacity'; // 선명도 유지를 위한 힌트
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

        requestAnimationFrame(() => {
          content.style.opacity = '1';
        });
      } else {
        const content = existingOverlay.getContent();
        existingOverlay.setZIndex(baseZIndex);
        if (content instanceof HTMLElement) {
          cancelPendingRemoval(post.id, content);
          
          content.style.transformOrigin = 'bottom center';
          content.style.willChange = 'transform, opacity'; // 선명도 유지를 위한 힌트
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
    
    const isBrokenUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return true;
      return url.includes('images.unsplash.com') && (url.includes('source.unsplash.com') || url.length < 50);
    };

    let displayImage = post.image;
    // [FIX] 마커 이미지도 고화질로 처리
    if (displayImage && displayImage.includes('unsplash.com')) {
      displayImage = displayImage.split('?')[0] + "?auto=format&fit=crop&w=200&q=80";
    }

    if (isBrokenUrl(displayImage)) {
      displayImage = `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=200&q=80&sig=${post.id}`;
    }

    let pinColor = ''; let labelText = ''; let labelBg = ''; let labelColor = 'white'; let borderClass = '';
    if (isMine) { pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container'; }
    else if (isAd) { pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container'; }
    else if (borderType === 'popular') { pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container'; }
    else if (borderType === 'diamond') { pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; borderClass = 'diamond-border-container'; }
    else if (borderType === 'gold') { pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; borderClass = 'gold-border-container'; }
    else if (borderType === 'silver') { pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 8px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.1);">${labelText}</div>` : '';
    
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) && !isMine ? 'animate-marker-float' : '');

    let inlineBorderStyle = "border: 2.5px solid #ffffff;";
    let inlineShadow = "0 8px 16px -2px rgba(0, 0, 0, 0.15)";

    if (borderType === 'diamond') {
      inlineBorderStyle = "border: 4px solid #22d3ee;";
      inlineShadow = "0 0 20px rgba(34, 211, 238, 0.8), 0 0 0 2px #a5f3fc";
    } else if (borderType === 'gold') {
      inlineBorderStyle = "border: 4px solid #fbbf24;";
      inlineShadow = "0 0 15px rgba(251, 191, 36, 0.6)";
    } else if (borderType === 'silver') {
      inlineBorderStyle = "border: 3.5px solid #94a3b8;";
      inlineShadow = "0 0 10px rgba(148, 163, 184, 0.4)";
    } else if (borderType === 'popular') {
      inlineBorderStyle = "border: 3.5px solid #ef4444;";
      inlineShadow = "0 0 15px rgba(239, 68, 68, 0.5)";
    } else if (isMine) {
      inlineBorderStyle = "border: 3.5px solid #4f46e5;";
      inlineShadow = "0 0 15px rgba(79, 70, 229, 0.4)";
    }

    return `<div class="marker-content-wrapper"><div class="marker-highlight-ping"></div><div class="${animationClass}">${labelHtml}<div class="${borderClass}" style="width: 58px; height: 58px; border-radius: 20px; position: relative; z-index: 2; ${inlineBorderStyle} overflow: visible; box-shadow: ${inlineShadow}; background-color: white; box-sizing: border-box;"><div style="width: 100%; height: 100%; border-radius: 14px; overflow: hidden; position: relative;" class="shine-overlay"><img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(0.8) brightness(0.7);' : ''}" /><div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); backdrop-blur: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 6px; z-index: 5; border: 1px solid rgba(255,255,255,0.2);">${post.likes >= 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}</div>${videoIconHtml}</div></div>${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 18px; height: 14px; z-index: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"><svg width="18" height="14" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}</div></div>`;
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