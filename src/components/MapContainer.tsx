"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
  selectionLocation?: { lat: number; lng: number } | null;
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
  selectionLocation,
  searchResultLocation
}: MapContainerProps) => {
  const { user: authUser } = useAuth();
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const searchOverlayRef = useRef<any>(null);
  const lastDragEnd = useRef<number>(0);
  const isProgrammaticMove = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapChangeRef = useRef(onMapChange);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onMapChangeRef.current = onMapChange; }, [onMapChange]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const [isMapReady, setIsMapReady] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(6);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;
    const initMap = () => {
      try {
        const kakao = (window as any).kakao;
        if (!kakao?.maps?.Map || !kakao?.maps?.LatLng) return false;
        const options = { center: new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780), level: 6 };
        const map = new kakao.maps.Map(mapElement.current!, options);
        map.setMaxLevel(10);
        mapInstance.current = map;
        const updateMapData = () => {
          if (isProgrammaticMove.current) return;
          try {
            const bounds = map.getBounds();
            setCurrentLevel(map.getLevel());
            onMapChangeRef.current({
              bounds: { sw: { lat: bounds.getSouthWest().getLat(), lng: bounds.getSouthWest().getLng() }, ne: { lat: bounds.getNorthEast().getLat(), lng: bounds.getNorthEast().getLng() } },
              center: { lat: map.getCenter().getLat(), lng: map.getCenter().getLng() },
              level: map.getLevel()
            });
          } catch (e) {}
        };
        setIsMapReady(true);
        kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
        kakao.maps.event.addListener(map, 'dragstart', () => { isDragging.current = true; });
        kakao.maps.event.addListener(map, 'dragend', () => { isDragging.current = false; lastDragEnd.current = Date.now(); });
        return true;
      } catch (e) { return false; }
    };
    const timer = setInterval(() => { if (initMap()) clearInterval(timer); }, 100);
    return () => clearInterval(timer);
  }, []);

  // [수정] 광고 판별 로직
  const checkIsAd = (post: any) => {
    const name = String(post.user_name || post.user?.name || post.user?.nickname || "");
    return post.is_ad === true || post.isAd === true || name.includes("공식 파트너");
  };

  const getMarkerInnerHtml = (post: any, isViewed: boolean) => {
    // [중요] 1. 광고를 가장 먼저 판별합니다.
    const isAd = checkIsAd(post);
    
    // [중요] 2. 광고가 아닐 때만 내 포스팅(isMine)인지 확인합니다.
    // 이렇게 해야 '공식 파트너'의 글이 내 ID로 저장되어 있어도 AD로 표시됩니다.
    const isMine = !isAd && authUser && (post.user_id === authUser.id || post.user?.id === authUser.id);
    
    const borderType = post.borderType || 'none';
    const displayImage = post.image_url || post.image || FALLBACK_IMAGE;

    let pinColor = ''; let labelText = ''; let labelBg = ''; let borderClass = '';
    
    // 테두리 및 라벨 스타일 결정
    if (isAd) { 
      pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container'; 
    } else if (isMine) { 
      pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container'; 
    } else if (borderType === 'popular') { 
      pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container'; 
    } else if (borderType === 'diamond') { 
      pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; borderClass = 'diamond-border-container'; 
    } else if (borderType === 'gold') { 
      pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; borderClass = 'gold-border-container'; 
    } else if (borderType === 'silver') { 
      pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container'; 
    }

    // [복구] 일반 포스팅 전용 흰색 테두리
    const normalBorderStyle = borderClass ? "" : "border: 2px solid #ffffff;";

    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');
    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: white; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';

    return `
      <div class="marker-content-wrapper">
        <div class="marker-highlight-ping"></div>
        <div class="${animationClass}">
          ${labelHtml}
          <div class="${borderClass}" style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: white; ${normalBorderStyle}">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;">
              <img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes || 0}</div>
            </div>
          </div>
          ${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1;"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}
        </div>
      </div>`;
  };

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;
    if (currentLevel >= 11) { overlaysRef.current.forEach(o => o.setMap(null)); overlaysRef.current.clear(); return; }

    const currentPostIds = new Set(posts.map(p => p.id));
    overlaysRef.current.forEach((o, id) => { if (!currentPostIds.has(id)) { o.setMap(null); overlaysRef.current.delete(id); } });

    posts.forEach(post => {
      if (!post.id) return;
      const isViewed = viewedPostIds.has(post.id);
      const isAd = checkIsAd(post);
      
      const baseZIndex = isAd ? 600 : 300; // 광고 마커를 MY(내글)보다 위에 표시
      let scale = 1;
      if (currentLevel === 7) scale = 0.7; else if (currentLevel >= 8) scale = 0.5;

      const contentStateKey = `${post.likes}-${isViewed}-${currentLevel}-${isAd}`;
      const existingOverlay = overlaysRef.current.get(post.id);

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay animate-marker-appear';
        content.style.setProperty('--marker-scale', scale.toString());
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        content.onclick = (e) => { e.stopPropagation(); onMarkerClickRef.current(post); };
        
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(Number(post.latitude || post.lat), Number(post.longitude || post.lng)),
          content: content, yAnchor: 1, zIndex: baseZIndex
        });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        existingOverlay.setZIndex(baseZIndex);
        if (content && content.getAttribute('data-content-state') !== contentStateKey) {
          content.innerHTML = getMarkerInnerHtml(post, isViewed);
          content.setAttribute('data-content-state', contentStateKey);
        }
      }
    });
  }, [posts, viewedPostIds, isMapReady, currentLevel]);

  return <div className="w-full h-full relative bg-gray-100"><div ref={mapElement} className="w-full h-full" /></div>;
};

export default MapContainer;