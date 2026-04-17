"use client";

import React, { useEffect, useRef, useState } from 'react';
import { isGifUrl } from '@/lib/mock-data';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: (location?: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const MapContainer = ({ posts, viewedPostIds, highlightedPostId, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const { user: authUser } = useAuth();
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const actionOverlayRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastShowTime = useRef<number>(0);
  const isLongPressActive = useRef<boolean>(false);
  
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number, y: number } | null>(null);
  const MOVE_THRESHOLD = 10;

  const smoothMoveTo = (target: { lat: number, lng: number }) => {
    if (!mapInstance.current) return;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const map = mapInstance.current;
    const start = map.getCenter()!;
    const startLat = start.lat();
    const startLng = start.lng();
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentLat = startLat + (target.lat - startLat) * ease;
      const currentLng = startLng + (target.lng - startLng) * ease;

      map.setCenter({ lat: currentLat, lng: currentLng });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    const initMap = () => {
      const google = (window as any).google;
      if (typeof google === 'undefined' || !google.maps) return false;

      try {
        const map = new google.maps.Map(mapElement.current!, {
          center: center || { lat: 37.5665, lng: 126.9780 },
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapId: 'DEMO_MAP_ID',
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
          ]
        });

        mapInstance.current = map;
        setIsMapReady(true);

        const updateMapData = () => {
          const bounds = map.getBounds();
          const currentCenter = map.getCenter();
          if (bounds && currentCenter) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            onMapChange({
              bounds: { sw: { lat: sw.lat(), lng: sw.lng() }, ne: { lat: ne.lat(), lng: ne.lng() } },
              center: { lat: currentCenter.lat(), lng: currentCenter.lng() }
            });
          }
        };

        map.addListener('bounds_changed', updateMapData);
        map.addListener('idle', updateMapData);

        map.addListener('dragstart', () => {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          isLongPressActive.current = false;
          hideActionPin();
        });

        map.addListener('zoom_changed', () => {
          hideActionPin();
        });

        const handleStart = (e: any) => {
          const point = e.pixel || (e.touches && { x: e.touches[0].clientX, y: e.touches[0].clientY });
          if (!point) return;
          
          startPos.current = { x: point.x, y: point.y };
          isLongPressActive.current = false;
          
          if (pressTimer.current) clearTimeout(pressTimer.current);
          
          pressTimer.current = setTimeout(() => {
            const latLng = e.latLng;
            if (latLng) {
              isLongPressActive.current = true;
              showActionPin(latLng.lat(), latLng.lng());
              if (window.navigator.vibrate) window.navigator.vibrate(40);
            }
          }, 800);
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
        
        map.addListener('click', () => {
          if (isLongPressActive.current) {
            isLongPressActive.current = false;
            return;
          }
          hideActionPin();
        });

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
      const current = mapInstance.current.getCenter();
      if (current && (Math.abs(current.lat() - center.lat) > 0.0001 || Math.abs(current.lng() - center.lng) > 0.0001)) {
        smoothMoveTo(center);
      }
    }
  }, [center, isMapReady]);

  const showActionPin = (lat: number, lng: number) => {
    hideActionPin();
    const google = (window as any).google;
    if (!mapInstance.current || !google) return;

    lastShowTime.current = Date.now();

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

  const getMarkerHtml = (post: any, isViewed: boolean, isHighlighted: boolean) => {
    const isAd = post.isAd;
    const isMine = authUser && (post.user.id === authUser.id || post.user.id === 'me');
    const isGif = isGifUrl(post.image);
    const category = post.category || 'none';
    const borderType = post.borderType || 'none';

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
      else if (category === 'place') { iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>'; bgColor = '#16a34a'; }
      else if (category === 'animal') { iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>'; bgColor = '#9333ea'; }
      categoryIconHtml = `<div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg></div>`;
    }

    const labelHtml = labelText ? `<div style="width: 56px; background: ${labelBg}; color: ${labelColor}; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">${labelText}</div>` : '';
    const animationClass = isAd ? 'animate-ad-breathing' : ((borderType !== 'none' || isMine) ? 'animate-marker-float' : '');

    return `
      <div class="marker-container" style="position: relative; width: 56px; height: 72px; transform: translate(-50%, -100%) ${isHighlighted ? 'scale(1.3)' : 'scale(1)'};">
        ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
        <div class="${animationClass}">
          ${labelHtml}
          <div class="${borderClass || ''}"
               style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                      ${borderClass ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : '#ffffff'};`}
                      overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                      background-color: white;">
            <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; position: relative;" class="${(borderType !== 'none' || isAd) ? 'shine-overlay' : ''}">
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
      </div>
    `;
  };

  useEffect(() => {
    const google = (window as any).google;
    if (!isMapReady || !mapInstance.current || !google) return;

    const currentPostIds = new Set(posts.map(p => p.id));

    markersRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        markersRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;

      const existingOverlay = markersRef.current.get(post.id);
      
      if (!existingOverlay) {
        const markerOverlay = new google.maps.OverlayView();
        markerOverlay.onAdd = function() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.width = '56px';
          div.style.height = '72px';
          div.style.cursor = 'pointer';
          div.classList.add('animate-marker-appear');
          div.style.zIndex = isHighlighted ? '1000' : (post.isAd ? '500' : (post.borderType !== 'none' ? '400' : '300'));
          
          let startX = 0;
          let startY = 0;
          const CLICK_THRESHOLD = 5;

          const handleDown = (e: any) => {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            startX = clientX;
            startY = clientY;
          };

          const handleUp = (e: any) => {
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            
            const diffX = Math.abs(clientX - startX);
            const diffY = Math.abs(clientY - startY);

            if (diffX < CLICK_THRESHOLD && diffY < CLICK_THRESHOLD) {
              e.stopPropagation();
              onMarkerClick(post);
            }
          };

          div.addEventListener('mousedown', handleDown);
          div.addEventListener('mouseup', handleUp);
          div.addEventListener('touchstart', handleDown, { passive: true });
          div.addEventListener('touchend', handleUp);

          div.innerHTML = getMarkerHtml(post, isViewed, isHighlighted);
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
      } else {
        const div = (existingOverlay as any).div;
        if (div) {
          const container = div.querySelector('.marker-container') as HTMLElement;
          if (container) {
            container.style.transform = `translate(-50%, -100%) ${isHighlighted ? 'scale(1.3)' : 'scale(1)'}`;
            div.style.zIndex = isHighlighted ? '1000' : (post.isAd ? '500' : (post.borderType !== 'none' ? '400' : '300'));
            
            let ping = container.querySelector('.marker-highlight-ping');
            if (isHighlighted && !ping) {
              const p = document.createElement('div');
              p.className = 'marker-highlight-ping';
              container.prepend(p);
            } else if (!isHighlighted && ping) {
              ping.remove();
            }

            const img = container.querySelector('img');
            if (img) {
              img.style.filter = isViewed ? 'grayscale(1) brightness(0.7)' : '';
            }
          }
        }
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, isMapReady, authUser]);

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