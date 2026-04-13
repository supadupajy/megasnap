"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

// 사용자의 Client ID가 맞는지 다시 한번 확인이 필요할 수 있습니다.
const NAVER_CLIENT_ID = "ipu2vry3sw"; 
const NAVER_SDK_URL = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}`;

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const isScriptLoading = useRef(false);
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showDebug, setShowDebug] = useState(false);

  // 네이버가 체크할 가능성이 있는 주소들
  const urlOptions = [
    window.location.origin,
    window.location.origin + "/",
    `${window.location.protocol}//127.0.0.1:${window.location.port}`,
    `${window.location.protocol}//127.0.0.1:${window.location.port}/`
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("복사되었습니다!");
  };

  const initMap = () => {
    if (!window.naver || !window.naver.maps || !mapContainer.current) return;

    try {
      const naver = window.naver;
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

      // 인증 실패 시 네이버가 지도를 지워버리는 경우를 감지 (1.5초 후 체크)
      setTimeout(() => {
        if (mapContainer.current && mapContainer.current.children.length === 0) {
          setStatus('error');
        }
      }, 1500);

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
      handleIdle();
    } catch (e) {
      console.error("Map Init Error:", e);
      setStatus('error');
    }
  };

  const loadNaverMap = () => {
    if (window.naver && window.naver.maps) {
      initMap();
      return;
    }

    if (isScriptLoading.current) return;
    isScriptLoading.current = true;
    
    const script = document.createElement('script');
    script.src = NAVER_SDK_URL;
    script.async = true;

    script.onload = () => {
      isScriptLoading.current = false;
      if (window.naver && window.naver.maps) {
        initMap();
      } else {
        setStatus('error');
      }
    };

    script.onerror = () => {
      isScriptLoading.current = false;
      setStatus('error');
    };
    document.head.appendChild(script);
  };

  useEffect(() => {
    loadNaverMap();
  }, []);

  // 마커 업데이트 로직
  useEffect(() => {
    if (!mapInstance.current || !window.naver || status !== 'ready') return;
    const naver = window.naver;
    const map = mapInstance.current;

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
    <div className="relative w-full h-full bg-slate-900">
      <div ref={mapContainer} className="w-full h-full" />
      
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400">네이버 지도를 불러오는 중...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-[100] px-6 overflow-y-auto py-10">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 shrink-0">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          
          <h3 className="text-xl font-black text-white mb-2">지도 인증 실패 (해결 가이드)</h3>
          <p className="text-sm text-slate-400 mb-8 text-center max-w-xs">
            네이버는 보안상 등록된 주소와 100% 일치해야만 지도를 보여줍니다. 아래 주소들을 **모두** 등록해 보세요.
          </p>
          
          <div className="w-full max-w-sm space-y-3 mb-8">
            {urlOptions.map((url, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 p-3 rounded-xl group hover:border-blue-500/50 transition-colors">
                <code className="text-xs text-blue-400 font-mono truncate flex-1">{url}</code>
                <button 
                  onClick={() => copyToClipboard(url)}
                  className="p-2 bg-white/10 hover:bg-blue-500 text-white rounded-lg transition-all active:scale-90"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col w-full max-w-sm gap-3 mb-8">
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl">
              <a href="https://console.ncloud.com/naver-service/application" target="_blank" rel="noreferrer">
                네이버 콘솔 바로가기 <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()} className="text-slate-400 hover:text-white h-12 font-bold">
              <RefreshCw className="w-4 h-4 mr-2" /> 설정 후 새로고침
            </Button>
          </div>

          <div className="w-full max-w-sm border-t border-white/10 pt-6">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center justify-between w-full text-slate-500 text-xs font-bold uppercase tracking-widest"
            >
              상세 디버깅 정보 {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {showDebug && (
              <div className="mt-4 p-4 bg-black/40 rounded-xl text-[10px] font-mono text-slate-400 space-y-2 text-left overflow-x-auto">
                <p><span className="text-slate-600">Client ID:</span> {NAVER_CLIENT_ID}</p>
                <p><span className="text-slate-600">User Agent:</span> {navigator.userAgent.slice(0, 50)}...</p>
                <p><span className="text-slate-600">Referrer:</span> {document.referrer || 'None'}</p>
                <p className="text-red-400/80 mt-2">※ Client ID가 본인의 것이 맞는지 꼭 확인하세요!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;