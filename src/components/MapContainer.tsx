"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, onMapWriteClick, center }: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Map<any, any>>(new Map());
  const [actionPin, setActionPin] = useState<{ lat: number; lng: number } | null>(null);
  const actionOverlayRef = useRef<any>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);

  useEffect(() => {
    if (!mapElement.current || !window.google) return;

    const initialCenter = center || { lat: 37.5665, lng: 126.9780 };
    const mapOptions: google.maps.MapOptions = {
      center: initialCenter,
      zoom: 14,
      disableDefaultUI: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
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

    map.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      
      pressTimer.current = setTimeout(() => {
        if (e.latLng) {
          lastLongPressTime.current = Date.now();
          setActionPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        }
      }, 2000);
    });

    map.addListener('mouseup', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    map.addListener('dragstart', () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    });

    map.addListener('click', () => {
      const now = Date.now();
      if (now - lastLongPressTime.current < 500) return;
      setActionPin(null);
    });

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

    map.addListener('bounds_changed', updateBounds);
    updateBounds();

    return () => {
      google.maps.event.clearInstanceListeners(map);
    };
  }, []);

  useEffect(() => {
    if (mapInstance.current && center) {
      const map = mapInstance.current;
      const start = map.getCenter();
      if (!start) return;

      const startTime = performance.now();
      const duration = 1000;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const lat = start.lat() + (center.lat - start.lat()) * ease;
        const lng = start.lng() + (center.lng - start.lng()) * ease;
        map.setCenter({ lat, lng });
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    if (actionOverlayRef.current) {
      actionOverlayRef.current.setMap(null);
      actionOverlayRef.current = null;
    }
    if (actionPin) {
      class ActionMarker extends google.maps.OverlayView {
        latlng: google.maps.LatLng;
        div: HTMLDivElement | null = null;
        constructor(lat: number, lng: number) {
          super();
          this.latlng = new google.maps.LatLng(lat, lng);
        }
        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.cursor = 'pointer';
          div.style.zIndex = '1000';
          div.innerHTML = `
            <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div id="map-write-btn" style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                글쓰기
              </div>
              <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #4f46e5; margin: 0 auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
            </div>
            <style>
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
            </style>
          `;
          div.onclick = (e) => {
            e.stopPropagation();
            onMapWriteClick();
            setActionPin(null);
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
      const overlay = new ActionMarker(actionPin.lat, actionPin.lng);
      overlay.setMap(mapInstance.current);
      actionOverlayRef.current = overlay;
    }
  }, [actionPin]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    const map = mapInstance.current;
    
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
        
        const isAd = this.post.isAd;
        const isGif = this.post.isGif;
        const isPopular = !isAd && this.post.borderType === 'popular';
        const isInfluencer = !isAd && this.post.isInfluencer;
        
        const borderColor = isAd ? '#3b82f6' : (this.isViewed ? '#94a3b8' : '#ffffff');
        const pinColor = (isInfluencer || isPopular) ? (this.isViewed ? '#94a3b8' : (isInfluencer ? '#ffff00' : '#ff0000')) : (isAd ? '#3b82f6' : (this.isViewed ? '#94a3b8' : borderColor));

        div.innerHTML = `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div class="${isInfluencer ? 'influencer-border-container animate-influencer-glow' : (isPopular ? 'popular-border-container animate-popular-glow' : '')} ${this.isViewed ? 'viewed' : ''}"
                 style="width: 56px; height: 56px; border-radius: 16px;
                        ${(isPopular || isInfluencer) ? 'padding: 2px;' : `border: 2px solid ${borderColor};`}
                        overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : (this.isViewed ? '#94a3b8' : '#e5e7eb'))}; transition: all 0.3s;
                        filter: ${this.isViewed ? 'grayscale(1) brightness(0.7)' : 'none'};">
              <div style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
                <img src="${this.post.image}" 
                     onerror="this.src='https://picsum.photos/seed/${this.post.id}/300/300'"
                     style="width: 100%; height: 100%; object-fit: cover; ${this.isViewed ? 'filter: grayscale(0.5) brightness(0.8);' : ''}" />
                
                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 2px; z-index: 5;">
                  ${this.post.likes}
                </div>

                ${isGif ? `
                  <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; padding: 2px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                ` : ''}
              </div>
              ${isAd ? `
                <div style="position: absolute; top: 0; left: 0; background: #3b82f6; color: white;
                            font-size: 8px; font-weight: 900; padding: 2px 4px; border-bottom-right-radius: 8px; z-index: 10;">
                  AD
                </div>
              ` : ''}
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg);
                        width: 12px; height: 12px; background: ${pinColor};
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
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentPostIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    posts.forEach(post => {
      const isViewed = viewedPostIds.has(post.id);
      let overlay = overlaysRef.current.get(post.id);

      if (overlay) {
        if (overlay.isViewed !== isViewed || overlay.post.isInfluencer !== post.isInfluencer || overlay.post.isGif !== post.isGif || overlay.post.likes !== post.likes) {
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

  return <div ref={mapElement} className="w-full h-full bg-gray-100" />;
};

export default MapContainer;