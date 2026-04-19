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
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const level = map.getLevel();
            
            setCurrentLevel(level);
            onMapChangeRef.current({
              bounds: { 
                sw: { lat: sw.getLat(), lng: sw.getLng() }, 
                ne: { lat: ne.getLat(), lng: ne.getLng() } 
              },
              center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
              level: level
            });
          } catch (e) {
            console.error('Map update error:', e);
          }
        };

        updateMapData();
        setIsMapReady(true);

        kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
        kakao.maps.event.addListener(map, 'dragstart', () => { 
          isDragging.current = true; 
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            isProgrammaticMove.current = false;
          }
        });
        kakao.maps.event.addListener(map, 'dragend', () => { 
          isDragging.current = false; 
          lastDragEnd.current = Date.now(); 
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
    };

    const timer = setInterval(() => { 
      try {
        if (initMap()) clearInterval(timer); 
      } catch (e) {
        console.error('Map init interval error:', e);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const smoothMoveTo = (targetLat: number, targetLng: number) => {
    const map = mapInstance.current;
    const kakao = (window as any).kakao;
    if (!map || !kakao || !kakao.maps?.LatLng) return;

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
          onMapChangeRef.current({
            bounds: { 
              sw: { lat: bounds.getSouthWest().getLat(), lng: bounds.getSouthWest().getLng() }, 
              ne: { lat: bounds.getNorthEast().getLat(), lng: bounds.getNorthEast().getLng() } 
            },
            center: { lat: targetLat, lng: targetLng },
            level: map.getLevel()
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
    
    const displayImage = post.image;

    let pinColor = ''; let labelText = ''; let labelBg = ''; let labelColor = 'white'; let borderClass = '';
    if (isMine) { pinColor = '#4f46e5'; labelText = 'MY'; labelBg = '#4f46e5'; borderClass = 'my-post-border-container'; }
    else if (isAd) { pinColor = '#3b82f6'; labelText = 'AD'; labelBg = '#3b82f6'; borderClass = 'ad-border-container'; }
    else if (borderType === 'popular') { pinColor = '#ef4444'; labelText = 'HOT'; labelBg = '#ef4444'; borderClass = 'popular-border-container'; }
    else if (borderType === 'diamond') { pinColor = '#22d3ee'; labelText = 'DIAMOND'; labelBg = '#22d3ee'; labelColor = 'black'; borderClass = 'diamond-border-container'; }
    else if (borderType === 'gold') { pinColor = '#fbbf24'; labelText = 'GOLD'; labelBg = '#fbbf24'; labelColor = 'black'; borderClass = 'gold-border-container'; }
    else if (borderType === 'silver') { pinColor = '#94a3b8'; labelText = 'SILVER'; labelBg = '#94a3b8'; borderClass = 'silver-border-container'; }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';
    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');

    return `<div class="marker-content-wrapper"><div class="marker-highlight-ping"></div><div class="${animationClass}">${labelHtml}<div class="${borderClass || ''}" style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2; ${borderClass ? '' : `border: 2px solid #ffffff;`} overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: white;"><div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;"><img src="${displayImage}" onerror="this.src='${FALLBACK_IMAGE}'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" /><div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes}</div>${videoIconHtml}</div></div>${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1;"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}</div></div>`;
  };

  useEffect(() => {
    const kakao = (window as any).kakao;
    if (!isMapReady || !mapInstance.current || !kakao?.maps?.CustomOverlay) return;
    // 줌 레벨 제한을 11로 늘려 전국 단위에서도 마커가 보이도록 수정
    if (currentLevel >= 11) { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current.clear(); return; }

    const currentPostIds = new Set(posts.map(p => p.id));
    overlaysRef.current.forEach((overlay, id) => { if (!currentPostIds.has(id)) { overlay.setMap(null); overlaysRef.current.delete(id); } });

    posts.forEach(post => {
      if (!post) return;
      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const existingOverlay = overlaysRef.current.get(post.id);
      
      const baseZIndex = isHighlighted ? 10000 : (post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300));
      
      // 줌 레벨에 따른 마커 크기 조정 (멀어질수록 작게)
      let scale = 1;
      if (currentLevel === 7) scale = 0.6;
      else if (currentLevel === 8) scale = 0.4;
      else if (currentLevel === 9) scale = 0.25;
      else if (currentLevel === 10) scale = 0.15;

      const contentStateKey = `${post.likes}-${isViewed}-${post.image}-${currentLevel}-${!!post.videoUrl}-${!!post.youtubeUrl}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay animate-marker-appear';
        if (isHighlighted) content.classList.add('highlighted');
        content.style.setProperty('--marker-scale', scale.toString());
        content.setAttribute('data-content-state', contentStateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed);
        content.onclick = (e) => { 
          e.stopPropagation(); 
          if (isDragging.current || (Date.now() - lastDragEnd.current < 200)) return; 
          if (onMarkerClickRef.current) onMarkerClickRef.current(post); 
        };
        const overlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(post.lat, post.lng), content: content, yAnchor: 1, zIndex: baseZIndex });
        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent();
        existingOverlay.setZIndex(baseZIndex);
        if (content instanceof HTMLElement) {
          content.style.setProperty('--marker-scale', scale.toString());
          if (isHighlighted) content.classList.add('highlighted'); else content.classList.remove('highlighted');
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

  return <div className="w-full h-full relative bg-gray-100"><div ref={mapElement} className="w-full h-full" style={{ pointerEvents: 'auto' }} /></div>;
};

export default MapContainer;