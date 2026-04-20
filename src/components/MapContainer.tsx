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

        const options = {
          center: new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780),
          level: 6
        };

        const map = new kakao.maps.Map(mapElement.current!, options);
        map.setMaxLevel(10);
        mapInstance.current = map;

        const updateMapData = () => {
          if (isProgrammaticMove.current) return;
          try {
            const bounds = map.getBounds();
            const currentCenter = map.getCenter();
            setCurrentLevel(map.getLevel());
            onMapChangeRef.current({
              bounds: { 
                sw: { lat: bounds.getSouthWest().getLat(), lng: bounds.getSouthWest().getLng() }, 
                ne: { lat: bounds.getNorthEast().getLat(), lng: bounds.getNorthEast().getLng() } 
              },
              center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
              level: map.getLevel()
            });
          } catch (e) {}
        };

        updateMapData();
        setIsMapReady(true);
        kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
        kakao.maps.event.addListener(map, 'dragstart', () => { isDragging.current = true; });
        kakao.maps.event.addListener(map, 'dragend', () => { isDragging.current = false; lastDragEnd.current = Date.now(); });
        kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          if (Date.now() - lastDragEnd.current < 200) return;
          if (onMapClickRef.current) onMapClickRef.current({ lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() });
        });
        return true;
      } catch (e) { return false; }
    };

    const timer = setInterval(() => { if (initMap()) clearInterval(timer); }, 100);
    return () => clearInterval(timer);
  }, []);

  const getMarkerInnerHtml = (post: any, isViewed: boolean) => {
    // 1. 광고 판별 (닉네임 기준)
    const isAd = post.is_ad === true || post.isAd === true || post.user_name === '공식 파트너' || post.user?.name === '공식 파트너';
    const isMine = authUser && (post.user_id === authUser.id || post.user?.id === authUser.id);
    const borderType = post.borderType || 'none';
    const hasVideo = !!post.videoUrl || !!post.youtubeUrl;
    const displayImage = post.image_url || post.image || FALLBACK_IMAGE;

    let pinColor = ''; let labelText = ''; let labelBg = ''; let labelColor = 'white'; let borderClass = '';
    
    // 2. 테두리 스타일 결정
    if (isMine) { pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container'; }
    else if (isAd) { pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container'; }
    else if (borderType === 'popular') { pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container'; }
    else if (borderType === 'diamond') { pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; borderClass = 'diamond-border-container'; }
    else if (borderType === 'gold') { pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; borderClass = 'gold-border-container'; }
    else if (borderType === 'silver') { pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container'; }

    // 3. 애니메이션 클래스
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');
    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';

    return `
      <div class="marker-content-wrapper">
        <div class="marker-highlight-ping"></div>
        <div class="${animationClass}">
          ${labelHtml}
          <div class="${borderClass}" style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: white; ${borderClass ? '' : 'border: 2px solid #ffffff;'}">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;">
              <img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes || 0}</div>
              ${videoIconHtml}
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
      const isHighlighted = highlightedPostId === post.id;
      const isAd = post.is_ad === true || post.isAd === true || post.user_name === '공식 파트너' || post.user?.name === '공식 파트너';
      
      const baseZIndex = isHighlighted ? 10000 : (isAd ? 500 : 300);
      let scale = 1;
      if (currentLevel === 7) scale = 0.7; else if (currentLevel >= 8) scale = 0.5;

      // 갱신 여부 판단 키 (광고 여부 추가)
      const contentStateKey = `${post.likes}-${isViewed}-${post.image_url || post.image}-${currentLevel}-${isAd}`;

      const existingOverlay = overlaysRef.current.get(post.id);
      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay animate-marker-appear';
        if (isHighlighted) content.classList.add('highlighted');
        content.style.setProperty('--marker-scale', scale.toString());
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        content.onclick = (e) => { e.stopPropagation(); onMarkerClickRef.current(post); };
        
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(post.latitude || post.lat, post.longitude || post.lng),
          content: content, yAnchor: 1, zIndex: baseZIndex
        });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent() as HTMLElement;
        existingOverlay.setZIndex(baseZIndex);
        if (content) {
          content.style.setProperty('--marker-scale', scale.toString());
          if (isHighlighted) content.classList.add('highlighted'); else content.classList.remove('highlighted');
          // 데이터가 변했다면 HTML 갱신
          if (content.getAttribute('data-content-state') !== contentStateKey) {
            content.innerHTML = getMarkerInnerHtml(post, isViewed);
            content.setAttribute('data-content-state', contentStateKey);
          }
        }
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, currentLevel]);

  return <div className="w-full h-full relative bg-gray-100"><div ref={mapElement} className="w-full h-full" /></div>;
};

export default MapContainer;