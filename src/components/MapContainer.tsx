"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: (location?: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const MapContainer = ({ posts, viewedPostIds, highlightedPostId, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const { user: authUser } = useAuth();
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const actionOverlayRef = useRef<any>(null);
  const isDragging = useRef(false);
  
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number, y: number } | null>(null);
  const MOVE_THRESHOLD = 10;

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    const initMap = () => {
      const kakao = (window as any).kakao;
      if (!kakao || !kakao.maps) return false;

      try {
        const options = {
          center: new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780),
          level: 6
        };

        const map = new kakao.maps.Map(mapElement.current!, options);
        mapInstance.current = map;

        const updateMapData = () => {
          const bounds = map.getBounds();
          const currentCenter = map.getCenter();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          
          onMapChange({
            bounds: { 
              sw: { lat: sw.getLat(), lng: sw.getLng() }, 
              ne: { lat: ne.getLat(), lng: ne.getLng() } 
            },
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() }
          });
        };

        updateMapData();
        setIsMapReady(true);

        kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
        
        kakao.maps.event.addListener(map, 'dragstart', () => {
          isDragging.current = true;
          // 드래그 시작 시에는 핀을 숨기지 않고 유지 (사용자 요청: 다른 곳 클릭 시에만 삭제)
        });
        
        kakao.maps.event.addListener(map, 'dragend', () => {
          setTimeout(() => { isDragging.current = false; }, 50);
        });

        // 롱프레스 구현
        const handleStart = (e: any) => {
          const point = { x: e.offsetX || e.pageX, y: e.offsetY || e.pageY };
          startPos.current = point;
          
          if (pressTimer.current) clearTimeout(pressTimer.current);
          
          pressTimer.current = setTimeout(() => {
            const latLng = e.latLng;
            if (latLng) {
              showActionPin(latLng.getLat(), latLng.getLng());
              if (window.navigator.vibrate) window.navigator.vibrate(40);
            }
          }, 800);
        };

        kakao.maps.event.addListener(map, 'mousedown', handleStart);
        kakao.maps.event.addListener(map, 'mousemove', (e: any) => {
          if (!startPos.current) return;
          const point = { x: e.offsetX || e.pageX, y: e.offsetY || e.pageY };
          const dist = Math.sqrt(Math.pow(point.x - startPos.current.x, 2) + Math.pow(point.y - startPos.current.y, 2));
          if (dist > MOVE_THRESHOLD) {
            if (pressTimer.current) clearTimeout(pressTimer.current);
          }
        });
        
        kakao.maps.event.addListener(map, 'mouseup', () => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        });

        // 지도의 다른 부분을 클릭했을 때만 핀 숨기기
        kakao.maps.event.addListener(map, 'click', () => hideActionPin());

        return true;
      } catch (e) {
        console.error('Kakao Map Init Error:', e);
        setError("카카오 지도를 불러오는 중 오류가 발생했습니다.");
        return false;
      }
    };

    const timer = setInterval(() => {
      if (initMap()) clearInterval(timer);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isMapReady && mapInstance.current && center) {
      const kakao = (window as any).kakao;
      const moveLatLng = new kakao.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(moveLatLng);
    }
  }, [center, isMapReady]);

  const showActionPin = (lat: number, lng: number) => {
    hideActionPin();
    const kakao = (window as any).kakao;
    if (!mapInstance.current || !kakao) return;

    const content = document.createElement('div');
    content.className = 'kakao-overlay';
    // "+ 글쓰기" 문구 적용 및 디자인 강화
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; transform: translate(-50%, -100%); filter: drop-shadow(0 10px 20px rgba(79, 70, 229, 0.3));">
        <div style="background: #4f46e5; color: white; padding: 10px 18px; border-radius: 24px; font-weight: 900; font-size: 15px; display: flex; align-items: center; gap: 6px; white-space: nowrap; border: 2px solid rgba(255,255,255,0.2); transition: all 0.2s active:scale-95;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          글쓰기
        </div>
        <div style="width: 12px; height: 12px; background: #4f46e5; transform: rotate(45deg); margin-top: -8px; border-right: 2px solid rgba(255,255,255,0.2); border-bottom: 2px solid rgba(255,255,255,0.2);"></div>
      </div>
    `;
    
    content.onclick = (e) => {
      e.stopPropagation();
      if (isDragging.current) return;
      onMapWriteClick({ lat, lng });
      hideActionPin();
    };

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(lat, lng),
      content: content,
      yAnchor: 1,
      zIndex: 2000 // 마커들보다 위에 표시
    });

    overlay.setMap(mapInstance.current);
    actionOverlayRef.current = overlay;
  };

  const hideActionPin = () => {
    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
      actionOverlayRef.current = null;
    }
  };

  const getMarkerHtml = (post: any, isViewed: boolean, isHighlighted: boolean) => {
    const isAd = post.isAd;
    const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
    const category = post.category || 'none';
    const borderType = post.borderType || 'none';

    let pinColor = '';
    let labelText = '';
    let labelBg = '';
    let labelColor = 'white';
    let borderClass = '';

    if (isMine) {
      pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container';
    } else if (isAd) {
      pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container';
    } else if (borderType === 'popular') {
      pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container';
    } else if (borderType === 'diamond') {
      pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; borderClass = 'diamond-border-container';
    } else if (borderType === 'gold') {
      pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; borderClass = 'gold-border-container';
    } else if (borderType === 'silver') {
      pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container';
    }

    let categoryIconHtml = '';
    if (category !== 'none') {
      let iconSvg = '', bgColor = '';
      if (category === 'food') { iconSvg = '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>'; bgColor = '#f97316'; }
      else if (category === 'accident') { iconSvg = '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>'; bgColor = '#dc2626'; }
      else if (category === 'place') { iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>'; bgColor = '#16a34a'; }
      else if (category === 'animal') { iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>'; bgColor = '#9333ea'; }
      categoryIconHtml = `<div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></div>`;
    }

    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');

    return `
      <div class="marker-container" style="position: relative; width: 56px; height: 72px; transform: translate(-50%, -100%) ${isHighlighted ? 'scale(1.3)' : 'scale(1)'};">
        ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
        <div class="${animationClass}">
          ${labelHtml}
          <div class="${borderClass || ''}"
               style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                      ${borderClass ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : '#ffffff'};`}
                      overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                      background-color: white;">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;" class="${(borderType !== 'none' || isAd) ? 'shine-overlay' : ''}">
              <img src="${post.image}" 
                   onerror="this.src='${FALLBACK_IMAGE}'"
                   style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes}</div>
              ${categoryIconHtml}
            </div>
          </div>
          ${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1;"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}
        </div>
      </div>
    `;
  };

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao) return;

    const currentPostIds = new Set(posts.map(p => p.id));

    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;

      const existingOverlay = overlaysRef.current.get(post.id);
      
      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'kakao-overlay animate-marker-appear';
        content.style.zIndex = isHighlighted ? '1000' : (post.isAd ? '500' : (post.borderType !== 'none' ? '400' : '300'));
        content.innerHTML = getMarkerHtml(post, isViewed, isHighlighted);
        
        content.onclick = (e) => {
          e.stopPropagation();
          if (isDragging.current) return;
          onMarkerClick(post);
        };

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(post.lat, post.lng),
          content: content,
          yAnchor: 1
        });

        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent();
        if (content instanceof HTMLElement) {
          content.style.zIndex = isHighlighted ? '1000' : (post.isAd ? '500' : (post.borderType !== 'none' ? '400' : '300'));
          content.innerHTML = getMarkerHtml(post, isViewed, isHighlighted);
        }
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, authUser]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div ref={mapElement} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm z-[100] p-6 text-center">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-red-100 max-w-xs">
            <h3 className="text-lg font-black text-gray-900 mb-2">지도 로드 실패</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed break-keep mb-6">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;