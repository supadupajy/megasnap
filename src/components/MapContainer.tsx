"use client";

import React, { useEffect, useRef, useState } from 'react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  highlightedPostId?: string | null;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: (location?: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, highlightedPostId, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);
  const actionMarkerRef = useRef<naver.maps.Marker | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!mapElement.current || !window.naver) return;

    const initialCenter = center || { lat: 37.5665, lng: 126.9780 };
    const mapOptions: naver.maps.MapOptions = {
      center: new naver.maps.LatLng(initialCenter.lat, initialCenter.lng),
      zoom: 14,
      minZoom: 7,
      maxZoom: 19,
      logoControl: false,
      mapDataControl: false,
      scaleControl: false,
      zoomControl: false,
    };

    const map = new naver.maps.Map(mapElement.current, mapOptions);
    mapInstance.current = map;

    // 지도 이벤트 리스너
    naver.maps.Event.addListener(map, 'mousedown', (e: any) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        const latlng = e.coord;
        setActionPin({ lat: latlng.lat(), lng: latlng.lng() });
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }, 1000);
    });

    naver.maps.Event.addListener(map, 'mouseup', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    naver.maps.Event.addListener(map, 'dragstart', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    naver.maps.Event.addListener(map, 'click', () => {
      setActionPin(null);
    });

    const updateBounds = () => {
      const bounds = map.getBounds();
      if (bounds) {
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        onMapChange({
          bounds: {
            sw: { lat: sw.lat(), lng: sw.lng() },
            ne: { lat: ne.lat(), lng: ne.lng() }
          }
        });
      }
    };

    naver.maps.Event.addListener(map, 'bounds_changed', updateBounds);
    updateBounds();

    return () => {
      if (mapInstance.current) {
        naver.maps.Event.clearInstanceListeners(mapInstance.current);
      }
    };
  }, []);

  // 중심점 이동 처리
  useEffect(() => {
    if (mapInstance.current && center) {
      const map = mapInstance.current;
      const target = new naver.maps.LatLng(center.lat, center.lng);
      map.panTo(target, { duration: 1000, easing: 'easeOutCubic' });
    }
  }, [center]);

  // 액션 핀(롱프레스 글쓰기) 처리
  useEffect(() => {
    if (!mapInstance.current || !window.naver) return;
    
    if (actionMarkerRef.current) {
      actionMarkerRef.current.setMap(null);
      actionMarkerRef.current = null;
    }

    if (actionPin) {
      const content = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; transform: translate(-50%, -100%);">
          <div style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            글쓰기
          </div>
          <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #4f46e5;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        </div>
      `;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(actionPin.lat, actionPin.lng),
        map: mapInstance.current,
        icon: {
          content: content,
          anchor: new naver.maps.Point(0, 0),
        }
      });

      naver.maps.Event.addListener(marker, 'click', (e: any) => {
        e.domEvent.stopPropagation();
        onMapWriteClick({ lat: actionPin.lat, lng: actionPin.lng });
        setActionPin(null);
      });

      actionMarkerRef.current = marker;
    }
  }, [actionPin]);

  // 포스트 마커 업데이트
  useEffect(() => {
    if (!mapInstance.current || !window.naver) return;
    const map = mapInstance.current;

    const currentPostIds = new Set(posts.map(p => p.id));
    
    // 제거된 포스트 마커 삭제
    markersRef.current.forEach((marker, id) => {
      if (!currentPostIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // 새로운 포스트 마커 추가 또는 업데이트
    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      const isHighlighted = highlightedPostId === post.id;
      const isAd = post.isAd;
      const isPopular = !isAd && post.borderType === 'popular';
      const isInfluencer = !isAd && post.isInfluencer;
      const category = post.category || 'none';

      let categoryIconHtml = '';
      if (category !== 'none') {
        let iconSvg = '';
        let bgColor = '';
        if (category === 'food') {
          iconSvg = '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>';
          bgColor = '#f97316';
        } else if (category === 'accident') {
          iconSvg = '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>';
          bgColor = '#dc2626';
        } else if (category === 'place') {
          iconSvg = '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2a1 1 0 0 1-.8-1.7L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"></path><path d="M12 22v-3"></path>';
          bgColor = '#16a34a';
        } else if (category === 'animal') {
          iconSvg = '<path d="M11 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M18 5a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0V5z"></path><path d="M7 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M22 12a2.5 2.5 0 1 0-5 0v1a2.5 2.5 0 1 0 5 0v-1z"></path><path d="M12 21c-3.5 0-6-2.5-6-5.5s2.5-4.5 6-4.5 6 1.5 6 4.5-2.5 5.5-6 5.5z"></path>';
          bgColor = '#9333ea';
        }

        categoryIconHtml = `
          <div style="position: absolute; top: 0; right: 0; width: 20px; height: 20px; background: ${bgColor}; border-radius: 0 12px 0 12px; display: flex; align-items: center; justify-content: center; z-index: 20; border-left: 1.5px solid white; border-bottom: 1.5px solid white; box-shadow: -1px 1px 4px rgba(0,0,0,0.15);">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
          </div>
        `;
      }

      const labelHtml = isInfluencer ? 
        `<div style="width: 56px; background: #fbbf24; color: black; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: -0.02em; margin-bottom: -14px; position: relative; z-index: 1;">INFLUENCER</div>` :
        (isPopular ? `<div style="width: 56px; background: #ef4444; color: white; font-size: 7px; font-weight: 900; padding: 2px 0 14px 0; border-radius: 12px 12px 0 0; text-align: center; box-sizing: border-box; letter-spacing: 0.05em; margin-bottom: -14px; position: relative; z-index: 1;">HOT</div>` : '');

      const animationClass = isInfluencer ? 'animate-influencer-float' : (isPopular ? 'animate-hot-pulse' : '');
      const pinColor = isInfluencer ? '#fbbf24' : (isPopular ? '#ef4444' : '');

      const markerContent = `
        <div class="${animationClass}" style="position: relative; width: 56px; height: 72px; transform: translate(-50%, -100%) ${isHighlighted ? 'scale(1.35)' : 'scale(1)'}; transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);">
          ${isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
          ${labelHtml}
          <div class="${isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : '')}"
               style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                      ${(isPopular || isInfluencer) ? '' : `border: 2px solid ${isHighlighted ? '#22d3ee' : (isAd ? '#3b82f6' : '#ffffff')};`}
                      overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                      background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : '#e5e7eb')};">
            <div class="${isInfluencer ? 'shine-overlay' : ''}" style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
              <img src="${post.image}" 
                   style="width: 100%; height: 100%; object-fit: cover; ${isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
              <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 2px; z-index: 5;">
                ${post.likes}
              </div>
              ${post.isGif ? `
                <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; padding: 2px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
              ` : ''}
              ${categoryIconHtml}
            </div>
          </div>
          ${pinColor ? `
            <div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1;">
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/>
              </svg>
            </div>
          ` : ''}
        </div>
      `;

      let marker = markersRef.current.get(post.id);
      if (marker) {
        marker.setPosition(new naver.maps.LatLng(post.lat, post.lng));
        marker.setIcon({
          content: markerContent,
          anchor: new naver.maps.Point(0, 0),
        });
        marker.setZIndex(isHighlighted ? 1000 : (isAd ? 500 : (isPopular ? 400 : 100)));
      } else {
        marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(post.lat, post.lng),
          map: map,
          icon: {
            content: markerContent,
            anchor: new naver.maps.Point(0, 0),
          },
          zIndex: isHighlighted ? 1000 : (isAd ? 500 : (isPopular ? 400 : 100))
        });

        naver.maps.Event.addListener(marker, 'click', (e: any) => {
          e.domEvent.stopPropagation();
          onMarkerClick(post);
        });

        markersRef.current.set(post.id, marker);
      }
    });
  }, [posts, viewedPostIds, highlightedPostId]);

  return <div ref={mapElement} className="w-full h-full bg-gray-100" />;
};

export default MapContainer;