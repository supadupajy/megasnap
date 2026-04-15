"use client";

import React, { useEffect, useRef, useState } from 'react';
import { isGifUrl } from '@/lib/mock-data';
import { AlertCircle } from 'lucide-react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: (location?: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
  showDensity?: boolean;
}

const MapContainer = ({ posts, viewedPostIds, highlightedPostId, onMarkerClick, onMapChange, onMapWriteClick, center, showDensity }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const densityOverlaysRef = useRef<Map<string, any>>(new Map());
  const actionPin = useRef<{ lat: number; lng: number } | null>(null);
  const [actionPinState, setActionPinState] = useState<{ lat: number; lng: number } | null>(null);
  const actionOverlayRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);

  useEffect(() => {
    const initMap = () => {
      if (typeof window.kakao === 'undefined' || !window.kakao.maps) return false;
      if (!mapElement.current || mapInstance.current) return true;

      try {
        const initialCenter = new window.kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780);
        const mapOptions = { center: initialCenter, level: 4 };
        const map = new window.kakao.maps.Map(mapElement.current, mapOptions);
        mapInstance.current = map;
        setIsMapReady(true);
        setError(null);

        window.kakao.maps.event.addListener(map, 'mousedown', (e: any) => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
          pressTimer.current = setTimeout(() => {
            const latlng = e.latLng;
            if (latlng) {
              lastLongPressTime.current = Date.now();
              actionPin.current = { lat: latlng.getLat(), lng: latlng.getLng() };
              setActionPinState({ ...actionPin.current });
              if (window.navigator.vibrate) window.navigator.vibrate(50);
            }
          }, 1000);
        });

        const clearTimer = () => {
          if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
        };

        window.kakao.maps.event.addListener(map, 'dragstart', clearTimer);
        window.kakao.maps.event.addListener(map, 'mousemove', clearTimer);
        window.kakao.maps.event.addListener(map, 'click', () => {
          if (Date.now() - lastLongPressTime.current < 500) return;
          actionPin.current = null;
          setActionPinState(null);
        });

        const updateBounds = () => {
          const bounds = map.getBounds();
          if (bounds) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            onMapChange({
              bounds: {
                sw: { lat: sw.getLat(), lng: sw.getLng() },
                ne: { lat: ne.getLat(), lng: ne.getLng() }
              }
            });
          }
        };

        window.kakao.maps.event.addListener(map, 'bounds_changed', updateBounds);
        updateBounds();
        return true;
      } catch (e) {
        setError("지도를 초기화하는 중 오류가 발생했습니다.");
        return false;
      }
    };

    let retryCount = 0;
    const timer = setInterval(() => {
      if (initMap()) clearInterval(timer);
      else if (++retryCount >= 30) {
        clearInterval(timer);
        setError("카카오 SDK를 불러오지 못했습니다.");
      }
    }, 300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isMapReady && mapInstance.current && center && window.kakao?.maps) {
      mapInstance.current.panTo(new window.kakao.maps.LatLng(center.lat, center.lng));
    }
  }, [center, isMapReady]);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !window.kakao?.maps) return;
    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
      actionOverlayRef.current = null;
    }
    if (actionPinState) {
      const content = document.createElement('div');
      content.style.cssText = 'position: absolute; transform: translate(-50%, -100%); cursor: pointer; z-index: 2000;';
      content.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #4f46e5;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        </div>
      `;
      content.onclick = (e) => {
        e.stopPropagation();
        onMapWriteClick({ lat: actionPinState.lat, lng: actionPinState.lng });
        actionPin.current = null;
        setActionPinState(null);
      };
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(actionPinState.lat, actionPinState.lng),
        content: content,
        yAnchor: 1
      });
      overlay.setMap(mapInstance.current);
      actionOverlayRef.current = overlay;
    }
  }, [actionPinState, isMapReady]);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !window.kakao?.maps) return;
    const map = mapInstance.current;
    const currentPostIds = new Set(posts.map(p => p.id));
    
    // 밀집도 오버레이 관리
    densityOverlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id) || !showDensity) {
        overlay.setMap(null);
        densityOverlaysRef.current.delete(id);
      }
    });

    // 마커 오버레이 관리
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const isAd = post.isAd;
      const isPopular = !isAd && post.borderType === 'popular';
      const isInfluencer = !isAd && post.isInfluencer;
      const isGif = isGifUrl(post.image);
      const category = post.category || 'none';

      // 밀집도 시각화 (Heatmap 효과)
      if (showDensity) {
        let densityOverlay = densityOverlaysRef.current.get(post.id);
        if (!densityOverlay) {
          const densityContent = document.createElement('div');
          densityContent.style.cssText = `
            width: 120px; height: 120px; 
            background: radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0) 70%);
            border-radius: 50%; pointer-events: none;
          `;
          densityOverlay = new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(post.lat, post.lng),
            content: densityContent,
            zIndex: 1
          });
          densityOverlay.setMap(map);
          densityOverlaysRef.current.set(post.id, densityOverlay);
        }
      }

      // 마커 렌더링
      let pinColor = isInfluencer ? '#fbbf24' : (isPopular ? '#ef4444' : '');
      let categoryIconHtml = '';
      if (category !== 'none') {
        let iconSvg = '', bgColor = '';
        if (category === 'food') { iconSvg = '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>'; bgColor = '#f97316'; }
        else if (category === 'accident') { iconSvg = '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>'; bgColor = '#dc2626'; }
        else if (category === 'place') { iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>'; bgColor = '#16a34a'; }
        else if (category === 'animal') { iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>'; bgColor = '#9333ea'; }
        categoryIconHtml = `<div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white; box-shadow: -1px 1px 4px rgba(0,0,0,0.15);"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></div>`;
      }

      const labelHtml = isInfluencer ? `<div style="width: 56px; background: #fbbf24; color: black; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: -0.02em; margin-bottom: -14px; position: relative; z-index: 1;">INFLUENCER</div>` : (isPopular ? `<div style="width: 56px; background: #ef4444; color: white; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">HOT</div>` : '');
      const animationClass = (isInfluencer || isPopular) ? 'animate-influencer-float' : '';

      const markerContent = document.createElement('div');
      markerContent.style.cssText = 'position: absolute; transform: translate(-50%, -100%); width: 56px; height: 72px;';
      markerContent.innerHTML = `
        <div class="${animationClass}" style="position: relative; width: 56px; height: 72px; transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1); ${isHighlighted ? 'transform: scale(1.35);' : 'transform: scale(1);'}">
          ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
          ${labelHtml}
          <div class="${isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : '')} ${isViewed ? 'viewed' : ''}"
               style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                      ${(isPopular || isInfluencer) ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : (isAd ? '#3b82f6' : '#ffffff')};`}
                      overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                      background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : '#e5e7eb')}; transition: all 0.3s;">
            <div class="${isInfluencer ? 'shine-overlay' : ''}" style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
              <img src="${post.image}" onerror="this.src='https://picsum.photos/seed/${post.id}/300/300'" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 2px; z-index: 5;">${post.likes}</div>
              ${isGif ? `<div style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); color: white; width: 16px; height: 16px; border-radius: 50%; z-index: 5; border: 0.5px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : ''}
              ${categoryIconHtml}
            </div>
            ${isAd ? `<div style="position: absolute; top: 0; left: 0; background: #3b82f6; color: white; font-size: 8px; font-weight: 900; padding: 2px 4px; border-bottom-right-radius: 8px; z-index: 10;">AD</div>` : ''}
          </div>
          ${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));"><svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}
        </div>
      `;
      markerContent.onclick = (e) => { e.stopPropagation(); onMarkerClick(post); };

      let overlay = overlaysRef.current.get(post.id);
      if (overlay) overlay.setMap(null);
      overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(post.lat, post.lng),
        content: markerContent,
        yAnchor: 1,
        zIndex: isHighlighted ? 1000 : (isAd ? 500 : (isPopular ? 400 : 300))
      });
      overlay.setMap(map);
      overlaysRef.current.set(post.id, overlay);
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, showDensity]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div ref={mapElement} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm z-[100] p-6 text-center">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-red-100 max-w-xs">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div>
            <h3 className="text-lg font-black text-gray-900 mb-2">지도 로드 실패</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed break-keep mb-6">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;