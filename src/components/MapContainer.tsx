"use client";

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<number>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
}

declare global {
  interface Window {
    naver: any;
  }
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapElement.current || !window.naver) return;

    const location = new window.naver.maps.LatLng(37.5665, 126.9780);
    const mapOptions = {
      center: location,
      zoom: 14,
      minZoom: 7,
      maxZoom: 19,
      logoControl: false,
      mapDataControl: false,
      scaleControl: true,
      zoomControl: false,
    };

    const map = new window.naver.maps.Map(mapElement.current, mapOptions);
    mapRef.current = map;

    window.naver.maps.Event.addListener(map, 'idle', () => {
      const bounds = map.getBounds();
      onMapChange({
        bounds: {
          sw: { lat: bounds.getSW().lat(), lng: bounds.getSW().lng() },
          ne: { lat: bounds.getNE().lat(), lng: bounds.getNE().lng() }
        }
      });
    });

    return () => {
      if (mapRef.current) {
        window.naver.maps.Event.clearInstanceListeners(mapRef.current);
      }
    };
  }, []);

  // 마커 업데이트 로직
  useEffect(() => {
    if (!mapRef.current || !window.naver) return;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // 새 마커 생성
    posts.forEach((post) => {
      const isViewed = viewedPostIds.has(post.id);
      
      // 커스텀 마커 HTML
      const content = `
        <div class="marker-container" style="position: absolute; transform: translate(-50%, -50%); cursor: pointer;">
          <div class="marker-image-wrapper ${isViewed ? 'viewed' : ''}" 
               style="width: 56px; height: 56px; border-radius: 16px; border: 4px solid ${isViewed ? '#6b7280' : 'white'}; 
                      overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
                      transition: all 0.5s; ${isViewed ? 'filter: grayscale(1) brightness(0.5); opacity: 0.8; transform: scale(0.9);' : ''}">
            <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div class="marker-pin" 
               style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%) rotate(45deg); 
                      width: 12px; height: 12px; background: ${isViewed ? '#6b7280' : 'white'}; 
                      box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: background 0.5s;"></div>
        </div>
      `;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(post.lat, post.lng),
        map: mapRef.current,
        icon: {
          content: content,
          anchor: new window.naver.maps.Point(28, 28),
        }
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        onMarkerClick(post);
      });

      markersRef.current.push(marker);
    });
  }, [posts, viewedPostIds]);

  return <div ref={mapElement} className="w-full h-full" />;
};

export default MapContainer;