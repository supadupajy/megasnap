"use client";

import React, { useEffect, useRef } from 'react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, center }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<any, any>>(new Map());

  useEffect(() => {
    // 네이버 지도 API가 로드되었는지 확인
    if (!mapElement.current || typeof window === 'undefined' || !window.naver) {
      console.warn("Naver Maps API not loaded yet.");
      return;
    }

    const initialCenter = center || { lat: 37.5665, lng: 126.9780 };
    const mapOptions = {
      center: new window.naver.maps.LatLng(initialCenter.lat, initialCenter.lng),
      zoom: 14,
      minZoom: 6,
      maxZoom: 19,
      logoControl: false,
      mapDataControl: false,
      scaleControl: false,
      zoomControl: false,
    };

    const map = new window.naver.maps.Map(mapElement.current, mapOptions);
    mapInstance.current = map;

    const updateBounds = () => {
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

    window.naver.maps.Event.addListener(map, 'idle', updateBounds);
    updateBounds();

    return () => {
      if (window.naver && map) {
        window.naver.maps.Event.clearInstanceListeners(map);
      }
    };
  }, []);

  // Handle center prop changes to move the map
  useEffect(() => {
    if (mapInstance.current && center && window.naver) {
      const newCenter = new window.naver.maps.LatLng(center.lat, center.lng);
      mapInstance.current.panTo(newCenter);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !window.naver) return;

    const map = mapInstance.current;
    const currentPostIds = new Set(posts.map(p => p.id));

    // Remove markers that are no longer in posts
    markersRef.current.forEach((marker, id) => {
      if (!currentPostIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      let marker = markersRef.current.get(post.id);

      const content = `
        <div style="transform: translate(-50%, -50%); cursor: pointer; position: relative;">
          <div style="width: 56px; height: 56px; border-radius: 16px; border: 4px solid ${isViewed ? '#6b7280' : '#ffffff'}; 
                      overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
                      background: #e5e7eb; transition: all 0.3s; 
                      filter: ${isViewed ? 'grayscale(1) brightness(0.5)' : 'none'};">
            <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </div>
          <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); 
                      width: 12px; height: 12px; background: ${isViewed ? '#6b7280' : '#ffffff'}; 
                      box-shadow: 1px 1px 2px rgba(0,0,0,0.1); z-index: -1;"></div>
        </div>
      `;

      if (marker) {
        marker.setContent(content);
      } else {
        marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(post.lat, post.lng),
          map: map,
          icon: {
            content: content,
            anchor: new window.naver.maps.Point(28, 28),
          }
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          onMarkerClick(post);
        });

        markersRef.current.set(post.id, marker);
      }
    });
  }, [posts, viewedPostIds, onMarkerClick]);

  return (
    <div ref={mapElement} style={{ width: '100%', height: '100%' }} className="bg-gray-100" />
  );
};

export default MapContainer;