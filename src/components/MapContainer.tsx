"use client";

import React, { useEffect, useRef, useState } from 'react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

declare global {
  interface Window {
    kakao: any;
  }
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const actionOverlayRef = useRef<any>(null);
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current || !window.kakao) return;

    const kakao = window.kakao;
    const initialCenter = new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780);
    
    const options = {
      center: initialCenter,
      level: 4
    };

    const map = new kakao.maps.Map(mapContainer.current, options);
    mapInstance.current = map;

    // 지도 이벤트 설정
    const handleIdle = () => {
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

    kakao.maps.event.addListener(map, 'idle', handleIdle);
    
    // 롱프레스 구현을 위한 마우스/터치 이벤트
    const container = mapContainer.current;
    
    const startPress = (e: any) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        // 현재 마우스/터치 위치의 좌표 계산 (카카오맵 API 활용)
        // 여기서는 단순화를 위해 클릭 이벤트에서 좌표를 가져오는 방식을 보완하여 사용
      }, 1500);
    };

    // 카카오맵 클릭 이벤트로 롱프레스 좌표 획득
    kakao.maps.event.addListener(map, 'mousedown', (mouseEvent: any) => {
      const latlng = mouseEvent.latLng;
      pressTimer.current = setTimeout(() => {
        lastLongPressTime.current = Date.now();
        setActionPin({ lat: latlng.getLat(), lng: latlng.getLng() });
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }, 1000);
    });

    const clearTimer = () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };

    kakao.maps.event.addListener(map, 'mouseup', clearTimer);
    kakao.maps.event.addListener(map, 'dragstart', clearTimer);
    
    kakao.maps.event.addListener(map, 'click', () => {
      const now = Date.now();
      if (now - lastLongPressTime.current < 500) return;
      setActionPin(null);
    });

    handleIdle();

    return () => {
      // 이벤트 해제 로직 (필요 시)
    };
  }, []);

  // 센터 변경 시 이동
  useEffect(() => {
    if (mapInstance.current && center && window.kakao) {
      const moveLatLon = new window.kakao.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(moveLatLon);
    }
  }, [center]);

  // 글쓰기 액션 핀 표시
  useEffect(() => {
    if (!mapInstance.current || !window.kakao) return;
    const kakao = window.kakao;

    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
    }

    if (actionPin) {
      const content = document.createElement('div');
      content.className = 'action-pin-overlay';
      content.innerHTML = `
        <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: auto;">
          <div id="map-write-btn" style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #22c55e;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        </div>
      `;

      content.onclick = (e) => {
        e.stopPropagation();
        onMapWriteClick();
        setActionPin(null);
      };

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(actionPin.lat, actionPin.lng),
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
    const kakao = window.kakao;
    const map = mapInstance.current;

    // 기존 오버레이 중 현재 리스트에 없는 것 제거
    const currentPostIds = new Set(posts.map(p => p.id));
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    // 새 포스트 오버레이 생성 및 업데이트
    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const existingOverlay = overlaysRef.current.get(post.id);

      // 상태가 변했거나 새로 생긴 경우에만 다시 그림
      if (!existingOverlay || existingOverlay._isViewed !== isViewed) {
        if (existingOverlay) existingOverlay.setMap(null);

        const isAd = post.isAd;
        const isGif = post.isGif;
        const isPopular = !isAd && post.borderType === 'popular';
        const isInfluencer = !isAd && post.isInfluencer;
        
        const borderColor = isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#ffffff');
        const pinColor = (isInfluencer || isPopular) ? (isViewed ? '#94a3b8' : (isInfluencer ? '#ffff00' : '#ff0000')) : (isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : borderColor));

        const content = document.createElement('div');
        content.style.cursor = 'pointer';
        content.innerHTML = `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div class="${isInfluencer ? 'influencer-border-container animate-influencer-glow' : (isPopular ? 'popular-border-container animate-popular-glow' : '')} ${isViewed ? 'viewed' : ''}"
                 style="width: 56px; height: 56px; border-radius: 16px;
                        ${(isPopular || isInfluencer) ? 'padding: 4px;' : `border: 4px solid ${borderColor};`}
                        overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#e5e7eb'))}; transition: all 0.3s;
                        filter: ${isViewed ? 'grayscale(1) brightness(0.7)' : 'none'};">
              <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
                <img src="${post.image}" 
                     style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(0.5) brightness(0.8);' : ''}" />
                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 2px; z-index: 5;">
                  ${post.likes}
                </div>
                ${isGif ? `
                  <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; padding: 2px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                ` : ''}
              </div>
              ${isAd ? `<div style="position: absolute; top: 0; left: 0; background: #3b82f6; color: white; font-size: 8px; font-weight: 900; padding: 2px 4px; border-bottom-right-radius: 8px; z-index: 10;">AD</div>` : ''}
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 12px; height: 12px; background: ${pinColor}; box-shadow: 1px 1px 2px rgba(0,0,0,0.1);"></div>
          </div>
        `;

        content.onclick = (e) => {
          e.stopPropagation();
          onMarkerClick(post);
        };

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(post.lat, post.lng),
          content: content,
          yAnchor: 1
        });

        overlay._isViewed = isViewed;
        overlay.setMap(map);
        overlaysRef.current.set(post.id, overlay);
      }
    });
  }, [posts, viewedPostIds, onMarkerClick]);

  return <div ref={mapContainer} className="w-full h-full bg-gray-100" />;
};

export default MapContainer;