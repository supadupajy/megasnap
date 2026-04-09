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
  const overlaysRef = useRef<Map<any, any>>(new Map());

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

  useEffect(() => {
    if (mapInstance.current && center) {
      mapInstance.current.panTo(center);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;

    const map = mapInstance.current;
    
    // Define Custom Overlay Class
    class HTMLMarker extends google.maps.OverlayView {
      latlng: google.maps.LatLng;
      div: HTMLDivElement | null = null;
      post: any;
      isViewed: boolean;
      onClick: () => void;

      constructor(post: any, isViewed: boolean, onClick: () => void) {
        super();
        this.latlng = new google.maps.LatLng(post.lat, post.lng);
        this.post = post;
        this.isViewed = isViewed;
        this.onClick = onClick;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.cursor = 'pointer';
        div.style.width = '56px';
        div.style.height = '56px';
        
        const borderColor = this.post.isAd ? '#3b82f6' : (this.isViewed ? '#6b7280' : '#ffffff');
        const content = this.post.isAd 
          ? `<div style="width: 100%; height: 100%; display: flex; items-center; justify-content: center; background: #3b82f6; color: white; font-weight: 900; font-size: 14px; letter-spacing: -0.5px;">Ad</div>`
          : `<img src="${this.post.image}" style="width: 100%; height: 100%; object-fit: cover;" />`;

        div.innerHTML = `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div style="width: 56px; height: 56px; border-radius: 16px; border: 4px solid ${borderColor}; 
                        overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
                        background: #e5e7eb; transition: all 0.3s; 
                        filter: ${!this.post.isAd && this.isViewed ? 'grayscale(1) brightness(0.5)' : 'none'};">
              ${content}
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); 
                        width: 12px; height: 12px; background: ${borderColor}; 
                        box-shadow: 1px 1px 2px rgba(0,0,0,0.1);"></div>
          </div>
        `;

        div.onclick = (e) => {
          e.stopPropagation();
          this.onClick();
        };

        this.div = div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        const overlayProjection = this.getProjection();
        const point = overlayProjection.fromLatLngToDivPixel(this.latlng);
        if (this.div && point) {
          this.div.style.left = point.x + 'px';
          this.div.style.top = point.y + 'px';
        }
      }

      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const currentPostIds = new Set(posts.map(p => p.id));

    // Remove old overlays
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    // Add or update overlays
    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      let overlay = overlaysRef.current.get(post.id);

      if (overlay) {
        if (overlay.isViewed !== isViewed) {
          overlay.setMap(null);
          overlay = new HTMLMarker(post, isViewed, () => onMarkerClick(post));
          overlay.setMap(map);
          overlaysRef.current.set(post.id, overlay);
        }
      } else {
        overlay = new HTMLMarker(post, isViewed, () => onMarkerClick(post));
        overlay.setMap(map);
        overlaysRef.current.set(post.id, overlay);
      }
    });
  }, [posts, viewedPostIds, onMarkerClick]);

  return (
    <div ref={mapElement} className="w-full h-full bg-gray-100" />
  );
};

export default MapContainer;