"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

// 발급받으신 네이버 Client ID를 적용했습니다.
const NAVER_CLIENT_ID = "ipu2vry3sw"; 
const NAVER_SDK_URL = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}`;

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const actionMarkerRef = useRef<any>(null);
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const loadNaverMap = () => {
    if (NAVER_CLIENT_ID === "YOUR_NAVER_CLIENT_ID") {
      setStatus('error');
      return;
    }

    setStatus('loading');
    
    const existingScript = document.getElementById('naver-map-sdk');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = 'naver-map-sdk';
    script.src = NAVER_SDK_URL;
    script.async = true;

    script.onload = () => {
      if (!window.naver || !window.naver.maps) {
        setStatus('error');
        return;
      }

      const naver = window.naver;
      if (!mapContainer.current) return;

      const initialCenter = new naver.maps.LatLng(center?.lat || 37.5665, center?.lng || 126.9780);
      
      const mapOptions = {
        center: initialCenter,
        zoom: 15,
        minZoom: 10,
        maxZoom: 21,
        logoControl: false,
        mapDataControl: false,
        scaleControl: false,
      };

      const map = new naver.maps.Map(mapContainer.current, mapOptions);
      mapInstance.current = map;
      setStatus('ready');

      // 지도 이벤트 설정
      const handleIdle = () => {
        const bounds = map.getBounds();
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        
        onMapChange({
          bounds: {
            sw: { lat: sw.lat(), lng: sw.lng() },
            ne: { lat: ne.lat(), lng: ne.lng() }
          }
        });
      };

      naver.maps.Event.addListener(map, 'idle', handleIdle);
      
      // 롱프레스(길게 누르기)로 글쓰기 핀 생성
      naver.maps.Event.addListener(map, 'mousedown', (e: any) => {
        const latlng = e.coord;
        pressTimer.current = setTimeout(() => {
          setActionPin({ lat: latlng.lat(), lng: latlng.lng() });
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        }, 800);
      });

      const clearTimer = () => {
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }
      };

      naver.maps.Event.addListener(map, 'mouseup', clearTimer);
      naver.maps.Event.addListener(map, 'dragstart', clearTimer);
      naver.maps.Event.addListener(map, 'click', () => setActionPin(null));

      handleIdle();
    };

    script.onerror = () => setStatus('error');
    document.head.appendChild(script);
  };

  useEffect(() => {
    loadNaverMap();
  }, []);

  // 센터 변경 시 이동
  useEffect(() => {
    if (mapInstance.current && center && window.naver) {
      const moveLatLon = new window.naver.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(moveLatLon);
    }
  }, [center]);

  // 글쓰기 액션 핀 업데이트
  useEffect(() => {
    if (!mapInstance.current || !window.naver || status !== 'ready') return;
    const naver = window.naver;

    if (actionMarkerRef.current) actionMarkerRef.current.setMap(null);

    if (actionPin) {
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(actionPin.lat, actionPin.lng),
        map: mapInstance.current,
        icon: {
          content: `
            <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;">
              <div style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                글쓰기
              </div>
              <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #22c55e;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(0, 0),
        }
      });

      naver.maps.Event.addListener(marker, 'click', () => {
        onMapWriteClick();
        setActionPin(null);
      });

      actionMarkerRef.current = marker;
    }
  }, [actionPin, status]);

  // 포스트 마커 업데이트
  useEffect(() => {
    if (!mapInstance.current || !window.naver || status !== 'ready') return;
    const naver = window.naver;
    const map = mapInstance.current;

    const currentPostIds = new Set(posts.map(p => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentPostIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const existingMarker = markersRef.current.get(post.id);

      if (!existingMarker || existingMarker._isViewed !== isViewed) {
        if (existingMarker) existingMarker.setMap(null);

        const isAd = post.isAd;
        const isPopular = !isAd && post.borderType === 'popular';
        const isInfluencer = !isAd && post.isInfluencer;
        const pinColor = (isInfluencer || isPopular) ? (isViewed ? '#94a3b8' : (isInfluencer ? '#ffff00' : '#ff0000')) : (isAd ? '#3b82f6' : (isViewed ? '#94a3b8' : '#ffffff'));

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(post.lat, post.lng),
          map: map,
          icon: {
            content: `
              <div style="position: relative; transform: translate(-50%, -100%); cursor: pointer;">
                <div class="${isInfluencer ? 'influencer-border-container animate-influencer-glow' : (isPopular ? 'popular-border-container animate-popular-glow' : '')} ${isViewed ? 'viewed' : ''}"
                     style="width: 56px; height: 56px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                            background-color: ${pinColor}; transition: all 0.3s;">
                  <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
                    <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(0.5) brightness(0.8);' : ''}" />
                  </div>
                </div>
                <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 12px; height: 12px; background: ${pinColor};"></div>
              </div>
            `,
            anchor: new naver.maps.Point(0, 0),
          }
        });

        marker._isViewed = isViewed;
        naver.maps.Event.addListener(marker, 'click', () => onMarkerClick(post));
        markersRef.current.set(post.id, marker);
      }
    });
  }, [posts, viewedPostIds, status]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      <div ref={mapContainer} className="w-full h-full" />
      
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-500">지도를 불러오는 중...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 px-10 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">네이버 지도 설정 필요</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            네이버 클라우드 플랫폼에서 발급받은 <b>Client ID</b>를 코드에 입력해야 지도가 나타납니다.
          </p>
          <Button 
            onClick={loadNaverMap}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-6 gap-2"
          >
            <RefreshCw className="w-4 h-4" /> 다시 시도
          </Button>
        </div>
      )}
    </div>
  );
};

export default MapContainer;