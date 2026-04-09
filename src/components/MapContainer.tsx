"use client";

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, center }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<any, google.maps.Marker>>(new Map());

  useEffect(() => {
    if (!mapElement.current || !window.google) return;

    const initialCenter = center || { lat: 37.5665, lng: 126.9780 };
    const mapOptions: google.maps.MapOptions = {
      center: initialCenter,
      zoom: 14,
      disableDefaultUI: true,
      clickableIcons: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
      ],
    };

    const map = new google.maps.Map(mapElement.current, mapOptions);
    mapInstance.current = map;

    const updateBounds = () => {
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onMapChange({
          bounds: {
            sw: { lat: sw.lat(), lng: sw.lng() },
            ne: { lat: ne.lat(), lng: ne.lng() }
          }
        });
      }
    };

    map.addListener('idle', updateBounds);
    updateBounds();

    return () => {
      google.maps.event.clearInstanceListeners(map);
    };
  }, []);

  // Handle center prop changes to move the map
  useEffect(() => {
    if (mapInstance.current && center) {
      mapInstance.current.panTo(center);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;

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

      if (marker) {
        // Update existing marker if needed (e.g., color change)
        // For simplicity, we'll recreate the icon if viewed status changed
      } else {
        // Create custom marker element
        const markerDiv = document.createElement('div');
        markerDiv.className = 'custom-marker';
        markerDiv.style.position = 'relative';
        markerDiv.style.cursor = 'pointer';
        markerDiv.innerHTML = `
          <div style="width: 56px; height: 56px; border-radius: 16px; border: 4px solid ${isViewed ? '#6b7280' : '#ffffff'}; 
                      overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
                      background: #e5e7eb; transition: all 0.3s; 
                      filter: ${isViewed ? 'grayscale(1) brightness(0.5)' : 'none'};">
            <img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); 
                      width: 12px; height: 12px; background: ${isViewed ? '#6b7280' : '#ffffff'}; 
                      box-shadow: 1px 1px 2px rgba(0,0,0,0.1);"></div>
        `;

        // Using OverlayView for custom HTML markers in Google Maps is complex, 
        // so we'll use a standard marker with a data URI or simple styling for now.
        // For a truly custom look, we'd use an AdvancedMarkerElement (v3.53+)
        
        marker = new google.maps.Marker({
          position: { lat: post.lat, lng: post.lng },
          map: map,
          // Standard markers don't support arbitrary HTML easily without libraries,
          // so we'll use a simple colored pin for this implementation.
          title: post.location
        });

        marker.addListener('click', () => {
          onMarkerClick(post);
        });

        markersRef.current.set(post.id, marker);
      }
    });
  }, [posts, viewedPostIds, onMarkerClick]);

  return (
    <div ref={mapElement} className="w-full h-full bg-gray-100" />
  );
};

export default MapContainer;