"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const actionOverlayRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initMap = () => {
      if (!mapContainer.current || !window.kakao || !window.kakao.maps) return;

      window.kakao.maps.load(() => {
        const kakao = window.kakao;
        const initialCenter = new kakao.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780);
        
        const options = {
          center: initialCenter,
          level: 4
        };

        const map = new kakao.maps.Map(mapContainer.current, options);
        mapInstance.current = map;
        setIsLoaded(true);

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
        
        kakao.maps.event.addListener(map, 'mousedown', (mouseEvent: any) => {
          const latlng = mouseEvent.latLng;
          pressTimer.current = setTimeout(() => {
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
        kakao.maps.event.addListener(map, 'click', () => setActionPin(null));

        handleIdle();
      });
    };

    if (window.kakao && window.kakao.maps) {
      initMap();
    } else {
      // SDK가 아직 로드되지 않은 경우 대기
      const checkInterval = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(checkInterval);
          initMap();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  useEffect(() => {
    if (mapInstance.current && center && window.kakao) {
      const moveLatLon = new window.kakao.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(moveLatLon);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !window.kakao || !isLoaded) return;
    const kakao = window.kakao;

    if (actionOverlayRef.current) actionOverlayRef.current.setMap(null);

    if (actionPin) {
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: auto;">
          <div style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #22c55e;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
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
  }, [actionPin, isLoaded]);

  useEffect(() => {
    if (!mapInstance.current || !window.kakao || !isLoaded) return;
    const kakao = window.kakao;
    const map = mapInstance.current;

    const currentPostIds = new Set(posts.map(p => p.id));
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const existingOverlay = overlaysRef.current.get(post.id);

      if (!existingOverlay || existingOverlay._isViewed !== isViewed) {
        if (existingOverlay) existingOverlay.setMap(null);

        const isAd = post.isAd;
        const isPopular = !isAd && post.borderType === 'popular';
        const isInfluencer = !isAd && post.isInfluencer;
        const pinColor = (isInfluencer || isPopular) ? (isViewed ? '#94a3b8' : (isInfluencer ? '#ffff00' : '#ff0000')) : (isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#ffffff'));

        const content = document.createElement('div');
        content.style.cursor = 'pointer';
        content.innerHTML = `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div class="${isInfluencer ? 'influencer-border-container animate-influencer-glow' : (isPopular ? 'popular-border-container animate-popular-glow' : '')} ${isViewed ? 'viewed' : ''}"
                 style="width: 56px; height: 56px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        background-color: ${pinColor}; transition: all 0.3s;">
              <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
                <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(0.5) brightness(0.8);' : ''}" />
              </div>
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 12px; height: 12px; background: ${pinColor};"></div>
          </div>
        `;
        content.onclick = () => onMarkerClick(post);

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
  }, [posts, viewedPostIds, isLoaded]);

  return (
    <div className="relative w-full h-full bg-gray-100">
      <div ref={mapContainer} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-400">지도를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
};

export default MapContainer;