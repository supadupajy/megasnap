"use client";

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const actionOverlayRef = useRef<any>(null);
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);

  // 지도 초기화
  useEffect(() => {
    if (!mapElement.current || !window.kakao) return;

    const container = mapElement.current;
    const options = {
      center: new window.kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780),
      level: 4
    };

    const map = new window.kakao.maps.Map(container, options);
    mapInstance.current = map;

    // 지도 이벤트 리스너
    const updateBounds = () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onMapChange({
        bounds: {
          sw: { lat: sw.getLat(), lng: sw.getLng() },
          ne: { lat: ne.getLat(), lng: ne.getLng() }
        }
      });
    };

    window.kakao.maps.event.addListener(map, 'bounds_changed', updateBounds);
    
    // 롱프레스 구현 (카카오 지도는 기본 롱프레스가 없으므로 mousedown/up으로 구현)
    window.kakao.maps.event.addListener(map, 'mousedown', (mouseEvent: any) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      
      pressTimer.current = setTimeout(() => {
        const latlng = mouseEvent.latLng;
        if (latlng) {
          lastLongPressTime.current = Date.now();
          setActionPin({ lat: latlng.getLat(), lng: latlng.getLng() });
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        }
      }, 1000); // 1초 롱프레스
    });

    window.kakao.maps.event.addListener(map, 'mouseup', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    window.kakao.maps.event.addListener(map, 'dragstart', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    window.kakao.maps.event.addListener(map, 'click', () => {
      const now = Date.now();
      if (now - lastLongPressTime.current < 500) return;
      setActionPin(null);
    });

    updateBounds();
  }, []);

  // 중심점 이동 처리
  useEffect(() => {
    if (mapInstance.current && center) {
      const moveLatLon = new window.kakao.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(moveLatLon);
    }
  }, [center]);

  // 글쓰기 핀 (액션 핀) 처리
  useEffect(() => {
    if (!mapInstance.current || !window.kakao) return;

    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
    }

    if (actionPin) {
      const content = document.createElement('div');
      content.style.cursor = 'pointer';
      content.innerHTML = `
        <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div id="map-write-btn" style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #22c55e; margin: 0 auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        </div>
        <style>
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        </style>
      `;

      content.onclick = (e) => {
        e.stopPropagation();
        onMapWriteClick();
        setActionPin(null);
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(actionPin.lat, actionPin.lng),
        content: content,
        yAnchor: 1
      });

      overlay.setMap(mapInstance.current);
      actionOverlayRef.current = overlay;
    }
  }, [actionPin]);

  // 포스트 마커 업데이트
  useEffect(() => {
    if (!mapInstance.current || !window.kakao) return;

    const map = mapInstance.current;
    const currentPostIds = new Set(posts.map(p => p.id));

    // 제거된 포스트 오버레이 삭제
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    // 새 포스트 또는 업데이트된 포스트 오버레이 생성
    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const existingOverlay = overlaysRef.current.get(post.id);

      // 이미 존재하고 상태가 같다면 스킵
      if (existingOverlay && existingOverlay._isViewed === isViewed) return;

      // 기존 오버레이가 있으면 제거 후 재생성
      if (existingOverlay) {
        existingOverlay.setMap(null);
      }

      const isAd = post.isAd;
      const isPopular = !isAd && post.borderType === 'popular';
      const isInfluencer = !isAd && post.isInfluencer;
      const borderColor = isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#ffffff');

      const content = document.createElement('div');
      content.style.cursor = 'pointer';
      content.innerHTML = `
        <div style="position: relative; transform: translate(-50%, -100%);">
          <div class="${isInfluencer ? 'influencer-border-container animate-influencer-glow' : (isPopular ? 'popular-border-container animate-popular-glow' : '')} ${isViewed ? 'viewed' : ''}"
               style="width: 56px; height: 56px; border-radius: 16px;
                      ${(isPopular || isInfluencer) ? 'padding: 4px;' : `border: 4px solid ${borderColor};`}
                      overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                      background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#e5e7eb'))}; transition: all 0.3s;
                      filter: ${!isAd && !isPopular && !isInfluencer && isViewed ? 'grayscale(1) brightness(0.7)' : 'none'};">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white;">
              <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover; ${(isPopular || isInfluencer) && isViewed ? 'filter: grayscale(0.5) brightness(0.8);' : ''}" />
            </div>
            ${isAd ? `
              <div style="position: absolute; top: 0; left: 0; background: #3b82f6; color: white;
                          font-size: 8px; font-weight: 900; padding: 2px 4px; border-bottom-right-radius: 8px;">
                AD
              </div>
            ` : ''}
          </div>
          <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg);
                      width: 12px; height: 12px; background: ${isViewed ? '#94a3b8' : (isInfluencer ? '#ff0000' : (isPopular ? '#ccff00' : borderColor))};
                      box-shadow: 1px 1px 2px rgba(0,0,0,0.1);"></div>
        </div>
      `;

      content.onclick = (e) => {
        e.stopPropagation();
        onMarkerClick(post);
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(post.lat, post.lng),
        content: content,
        yAnchor: 1
      });

      // 상태 추적을 위한 커스텀 속성
      (overlay as any)._isViewed = isViewed;

      overlay.setMap(map);
      overlaysRef.current.set(post.id, overlay);
    });
  }, [posts, viewedPostIds, onMarkerClick]);

  return <div ref={mapElement} className="w-full h-full bg-gray-100" />;
};

export default MapContainer;