"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.OverlayView>>(new Map());
  const densityRef = useRef<Map<string, google.maps.OverlayView>>(new Map());
  const actionOverlayRef = useRef<google.maps.OverlayView | null>(null);
  
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number, y: number } | null>(null);
  const MOVE_THRESHOLD = 10;

  const densityData = useMemo(() => {
    if (!showDensity) return new Map<string, number>();
    const scores = new Map<string, number>();
    const THRESHOLD = 0.008;
    posts.forEach(p1 => {
      let count = 0;
      posts.forEach(p2 => {
        const dist = Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
        if (dist < THRESHOLD) count++;
      });
      scores.set(p1.id, count);
    });
    return scores;
  }, [posts, showDensity]);

  const getDensityStyle = (count: number) => {
    if (count <= 2) return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.2)' };
    if (count <= 5) return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.2)' };
    return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.2)' };
  };

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    const initMap = () => {
      if (typeof google === 'undefined' || !google.maps) return false;

      try {
        const map = new google.maps.Map(mapElement.current!, {
          center: center || { lat: 37.5665, lng: 126.9780 },
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
          ]
        });

        mapInstance.current = map;
        setIsMapReady(true);

        map.addListener('bounds_changed', () => {
          const bounds = map.getBounds();
          if (bounds) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            onMapChange({
              bounds: { sw: { lat: sw.lat(), lng: sw.lng() }, ne: { lat: ne.lat(), lng: ne.lng() } }
            });
          }
        });

        const handleStart = (e: any) => {
          const point = e.pixel || (e.touches && { x: e.touches[0].clientX, y: e.touches[0].clientY });
          if (!point) return;
          
          startPos.current = { x: point.x, y: point.y };
          if (pressTimer.current) clearTimeout(pressTimer.current);
          
          pressTimer.current = setTimeout(() => {
            const latLng = e.latLng;
            if (latLng) {
              showActionPin(latLng.lat(), latLng.lng());
              if (window.navigator.vibrate) window.navigator.vibrate(40);
            }
          }, 1000);
        };

        const handleMove = (e: any) => {
          if (!startPos.current) return;
          const point = e.pixel || (e.touches && { x: e.touches[0].clientX, y: e.touches[0].clientY });
          if (!point) return;

          const dist = Math.sqrt(Math.pow(point.x - startPos.current.x, 2) + Math.pow(point.y - startPos.current.y, 2));
          if (dist > MOVE_THRESHOLD) {
            clearTimer();
          }
        };

        const clearTimer = () => {
          if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
          startPos.current = null;
        };

        map.addListener('mousedown', handleStart);
        map.addListener('mousemove', handleMove);
        map.addListener('mouseup', clearTimer);
        map.addListener('dragstart', clearTimer);
        map.addListener('zoom_changed', clearTimer);
        map.addListener('click', hideActionPin);

        return true;
      } catch (e) {
        setError("지도를 불러오는 중 오류가 발생했습니다.");
        return false;
      }
    };

    const timer = setInterval(() => {
      if (initMap()) clearInterval(timer);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isMapReady && mapInstance.current && center) {
      mapInstance.current.panTo(center);
    }
  }, [center, isMapReady]);

  const showActionPin = (lat: number, lng: number) => {
    hideActionPin();
    if (!mapInstance.current) return;

    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.cursor = 'pointer';
      div.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; transform: translate(-50%, -100%);">
          <div style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #4f46e5;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        </div>
      `;
      div.onclick = (e) => {
        e.stopPropagation();
        onMapWriteClick({ lat, lng });
        hideActionPin();
      };
      this.getPanes()!.floatPane.appendChild(div);
      (this as any).div = div;
    };
    overlay.draw = function() {
      const projection = this.getProjection();
      const position = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng))!;
      const div = (this as any).div;
      if (div) {
        div.style.left = position.x + 'px';
        div.style.top = position.y + 'px';
      }
    };
    overlay.onRemove = function() {
      if ((this as any).div) {
        (this as any).div.parentNode.removeChild((this as any).div);
        (this as any).div = null;
      }
    };
    overlay.setMap(mapInstance.current);
    actionOverlayRef.current = overlay;
  };

  const hideActionPin = () => {
    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
      actionOverlayRef.current = null;
    }
  };

  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;

    const currentPostIds = new Set(posts.map(p => p.id));

    markersRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        markersRef.current.delete(id);
      }
    });
    densityRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id) || !showDensity) {
        overlay.setMap(null);
        densityRef.current.delete(id);
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

      if (showDensity && !densityRef.current.has(post.id)) {
        const count = densityData.get(post.id) || 1;
        const style = getDensityStyle(count);
        const densityOverlay = new google.maps.OverlayView();
        densityOverlay.onAdd = function() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.width = '240px';
          div.style.height = '240px';
          div.style.backgroundColor = style.bg;
          div.style.border = `1px solid ${style.border}`;
          div.style.borderRadius = '50%';
          div.style.pointerEvents = 'none';
          div.style.transform = 'translate(-50%, calc(-50% - 36px))';
          div.style.zIndex = '1';
          this.getPanes()!.overlayLayer.appendChild(div);
          (this as any).div = div;
        };
        densityOverlay.draw = function() {
          const projection = this.getProjection();
          const position = projection.fromLatLngToDivPixel(new google.maps.LatLng(post.lat, post.lng))!;
          const div = (this as any).div;
          if (div) {
            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';
          }
        };
        densityOverlay.onRemove = function() {
          if ((this as any).div) {
            (this as any).div.parentNode.removeChild((this as any).div);
            (this as any).div = null;
          }
        };
        densityOverlay.setMap(mapInstance.current);
        densityRef.current.set(post.id, densityOverlay);
      }

      if (!markersRef.current.has(post.id)) {
        const markerOverlay = new google.maps.OverlayView();
        markerOverlay.onAdd = function() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.width = '56px';
          div.style.height = '72px';
          div.style.cursor = 'pointer';
          div.style.zIndex = isHighlighted ? '1000' : (isAd ? '500' : (isPopular ? '400' : '300'));

          let pinColor = isInfluencer ? '#fbbf24' : (isPopular ? '#ef4444' : (isAd ? '#3b82f6' : ''));
          let categoryIconHtml = '';
          if (category !== 'none') {
            let iconSvg = '', bgColor = '';
            if (category === 'food') { iconSvg = '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>'; bgColor = '#f97316'; }
            else if (category === 'accident') { iconSvg = '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>'; bgColor = '#dc2626'; }
            else if (category === 'place') { iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>'; bgColor = '#16a34a'; }
            else if (category === 'animal') { iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>'; bgColor = '#9333ea'; }
            categoryIconHtml = `<div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></div>`;
          }

          const labelHtml = isInfluencer ? `<div style="width: 56px; background: #fbbf24; color: black; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: -0.02em; margin-bottom: -14px; position: relative; z-index: 1;">INFLUENCER</div>` : (isPopular ? `<div style="width: 56px; background: #ef4444; color: white; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">HOT</div>` : (isAd ? `<div style="width: 56px; background: #3b82f6; color: white; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">AD</div>` : ''));
          
          const borderContainerClass = isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : (isAd ? 'ad-border-container' : ''));

          div.innerHTML = `
            <div style="position: relative; width: 56px; height: 72px; transform: translate(-50%, -100%); ${isHighlighted ? 'transform: translate(-50%, -100%) scale(1.3);' : ''}">
              ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
              ${labelHtml}
              <div class="${borderContainerClass}"
                   style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                          ${(isPopular || isInfluencer || isAd) ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : '#ffffff'};`}
                          overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                          background-color: white;">
                <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;">
                  <img src="${post.image}" 
                       onerror="this.src='${FALLBACK_IMAGE}'"
                       style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
                  <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; z-index: 5;">${post.likes}</div>
                  ${isGif ? `<div style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.4); color: white; width: 16px; height: 16px; border-radius: 50%; z-index: 5; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>` : ''}
                  ${categoryIconHtml}
                </div>
              </div>
              ${pinColor ? `<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1;"><svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/></svg></div>` : ''}
            </div>
          `;
          div.onclick = (e) => { e.stopPropagation(); onMarkerClick(post); };
          this.getPanes()!.overlayMouseTarget.appendChild(div);
          (this as any).div = div;
        };
        markerOverlay.draw = function() {
          const projection = this.getProjection();
          const position = projection.fromLatLngToDivPixel(new google.maps.LatLng(post.lat, post.lng))!;
          const div = (this as any).div;
          if (div) {
            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';
          }
        };
        markerOverlay.onRemove = function() {
          if ((this as any).div) {
            (this as any).div.parentNode.removeChild((this as any).div);
            (this as any).div = null;
          }
        };
        markerOverlay.setMap(mapInstance.current);
        markersRef.current.set(post.id, markerOverlay);
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, showDensity, densityData]);

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