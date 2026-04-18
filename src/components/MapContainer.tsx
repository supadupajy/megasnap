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
  selectionLocation
}: MapContainerProps) => {
  const { user: authUser } = useAuth();
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const lastDragEnd = useRef<number>(0);
  const animationRef = useRef<number | null>(null);
  
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [isMapReady, setIsMapReady] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(6);
  const isDragging = useRef(false);

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
        map.setMaxLevel(10);
        mapInstance.current = map;

        const updateMapData = () => {
          const bounds = map.getBounds();
          const currentCenter = map.getCenter();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const level = map.getLevel();
          
          setCurrentLevel(level);
          
          onMapChange({
            bounds: { 
              sw: { lat: sw.getLat(), lng: sw.getLng() }, 
              ne: { lat: ne.getLat(), lng: ne.getLng() } 
            },
            center: { lat: currentCenter.getLat(), lng: currentCenter.getLng() },
            level: level
          });
        };

        updateMapData();
        setIsMapReady(true);

        kakao.maps.event.addListener(map, 'bounds_changed', updateMapData);
        kakao.maps.event.addListener(map, 'dragstart', () => { isDragging.current = true; });
        kakao.maps.event.addListener(map, 'dragend', () => { isDragging.current = false; lastDragEnd.current = Date.now(); });

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
      if (initMap()) clearInterval(timer);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const getMarkerInnerHtml = (post: any, isViewed: boolean, isHighlighted: boolean) => {
    const isAd = post.isAd;
    const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
    const category = post.category || 'none';
    const borderType = post.borderType || 'none';
    const hasVideo = !!post.youtubeUrl;

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
      else if (category === 'place') { iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>'; bgColor = '#16a34a'; }
      else if (category === 'animal') { iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>'; bgColor = '#9333ea'; }
      categoryIconHtml = `<div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></div>`;
    }

    const videoIconHtml = hasVideo ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 15; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : '';

    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');

    return `
      <div class="marker-content-wrapper">
        ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
        <div class="${animationClass}">
          ${labelHtml}
          <div class="${borderClass || ''}"
               style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                      ${borderClass ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : '#ffffff'};`}
                      overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                      background-color: white;">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;">
              <img src="${post.image}" 
                   onerror="this.src='${FALLBACK_IMAGE}'"
                   style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes}</div>
              ${categoryIconHtml}
              ${videoIconHtml}
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

    if (currentLevel >= 9) {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current.clear();
      return;
    }

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
      const baseZIndex = isHighlighted ? 1000 : (post.isAd ? 500 : (post.borderType !== 'none' ? 400 : 300));

      let scale = 1;
      if (currentLevel === 7) scale = 0.5;
      else if (currentLevel === 8) scale = 0.25;
      else if (currentLevel === 9) scale = 0.125;

      const stateKey = `${post.likes}-${isViewed}-${isHighlighted}-${post.image}-${currentLevel}-${!!post.youtubeUrl}`;

      if (!existingOverlay) {
        const content = document.createElement('div');
        content.className = 'marker-container kakao-overlay animate-marker-appear';
        if (isHighlighted) content.classList.add('highlighted');
        
        content.style.setProperty('--marker-scale', scale.toString());
        content.setAttribute('data-state', stateKey);
        content.innerHTML = getMarkerInnerHtml(post, isViewed, isHighlighted);

        content.onclick = (e) => {
          e.stopPropagation();
          if (isDragging.current || (Date.now() - lastDragEnd.current < 200)) return;
          onMarkerClick(post);
        };

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(post.lat, post.lng),
          content: content,
          yAnchor: 1,
          zIndex: baseZIndex
        });

        overlay.setMap(mapInstance.current);
        overlaysRef.current.set(post.id, overlay);
      } else {
        const content = existingOverlay.getContent();
        existingOverlay.setZIndex(baseZIndex);
        
        if (content instanceof HTMLElement) {
          content.style.setProperty('--marker-scale', scale.toString());
          if (isHighlighted) content.classList.add('highlighted');
          else content.classList.remove('highlighted');
          
          if (content.getAttribute('data-state') !== stateKey) {
            requestAnimationFrame(() => {
              content.innerHTML = getMarkerInnerHtml(post, isViewed, isHighlighted);
              content.setAttribute('data-state', stateKey);
            });
          }
        }
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, authUser, currentLevel]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div ref={mapElement} className="w-full h-full" style={{ pointerEvents: 'auto' }} />
    </div>
  );
};

export default MapContainer;