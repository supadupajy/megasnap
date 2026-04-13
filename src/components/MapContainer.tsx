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
      }, 1000);
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
          div.style.zIndex = '2000';
          div.style.transform = 'translate(-50%, -100%)';
          div.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div id="map-write-btn" style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); display: flex; align-items: center; gap: 4px; white-space: nowrap; animation: bounce 0.5s ease-out;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                글쓰기
              </div>
              <div style="width: 32px; height: 32px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 2px solid #4f46e5; margin: 0 auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
            </div>
          `;
          div.onclick = (e) => {
            e.stopPropagation();
            onMapWriteClick({ lat: actionPin.lat, lng: actionPin.lng });
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
      isHighlighted: boolean;
      onClick: () => void;

      constructor(post: any, isViewed: boolean, isHighlighted: boolean, onClick: () => void) {
        super();
        this.latlng = new google.maps.LatLng(post.lat, post.lng);
        this.post = post;
        this.isViewed = isViewed;
        this.isHighlighted = isHighlighted;
        this.onClick = onClick;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.cursor = 'pointer';
        div.style.width = '56px';
        div.style.height = '72px';
        div.style.transform = 'translate(-50%, -100%)';
        
        const isAd = this.post.isAd;
        const isGif = this.post.isGif;
        const isPopular = !isAd && this.post.borderType === 'popular';
        const isInfluencer = !isAd && this.post.isInfluencer;
        const category = this.post.category || 'none';
        
        let zIndex = 100;
        if (isAd) zIndex = 500;
        if (isPopular) zIndex = 400;
        if (isInfluencer) zIndex = 300;
        if (this.isHighlighted) zIndex = 1000;
        div.style.zIndex = zIndex.toString();

        // 삼각형 색상 결정 (특수 마커 전용)
        let pinColor = '';
        if (isInfluencer) pinColor = '#fbbf24';
        else if (isPopular) pinColor = '#ef4444';

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

        div.innerHTML = `
          <div class="${animationClass}" style="position: relative; width: 56px; height: 72px; 
               transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
               ${this.isHighlighted ? 'transform: scale(1.35);' : 'transform: scale(1);'}">
            ${this.isHighlighted ? '<div class="marker-highlight-ping"></div>' : ''}
            ${labelHtml}
            <div class="${isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : '')} ${this.isViewed ? 'viewed' : ''}"
                 style="width: 56px; height: 56px; border-radius: 16px; position: relative; z-index: 2;
                        ${(isPopular || isInfluencer) ? '' : `border: 2px solid ${this.isHighlighted ? '#22d3ee' : (isAd ? '#3b82f6' : '#ffffff')};`}
                        overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        background-color: ${(isPopular || isInfluencer) ? 'transparent' : (isAd ? '#3b82f6' : '#e5e7eb')}; transition: all 0.3s;">
              <div class="${isInfluencer ? 'shine-overlay' : ''}" style="width: 100%; height: 100%; border-radius: 12px; overflow: hidden; background: white; position: relative;">
                <img src="${this.post.image}" 
                     onerror="this.src='https://picsum.photos/seed/${this.post.id}/300/300'"
                     style="width: 100%; height: 100%; object-fit: cover; ${this.isViewed ? 'filter: grayscale(1) brightness(0.7);' : ''}" />
                
                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); color: white; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 2px; z-index: 5;">
                  ${this.post.likes}
                </div>

                ${isGif ? `
                  <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; padding: 2px; display: flex; align-items: center; justify-content: center; z-index: 5;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                ` : ''}
                ${categoryIconHtml}
              </div>
              ${isAd ? `
                <div style="position: absolute; top: 0; left: 0; background: #3b82f6; color: white;
                            font-size: 8px; font-weight: 900; padding: 2px 4px; border-bottom-right-radius: 8px; z-index: 10;">
                  AD
                </div>
              ` : ''}
            </div>
            ${pinColor ? `
              <!-- 특수 마커 전용 SVG 삼각형 핀 포인터 -->
              <div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 16px; height: 12px; z-index: 1; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));">
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12L0 0H16L8 12Z" fill="${pinColor}"/>
                </svg>
              </div>
            ` : ''}
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
      const isHighlighted = highlightedPostId === post.id;
      let overlay = overlaysRef.current.get(post.id);

      if (overlay) {
        if (overlay.isViewed !== isViewed || overlay.isHighlighted !== isHighlighted || overlay.post.isInfluencer !== post.isInfluencer || overlay.post.isGif !== post.isGif || overlay.post.likes !== post.likes || overlay.post.category !== post.category) {
          overlay.setMap(null);
          overlay = new HTMLMarker(post, isViewed, isHighlighted, () => onMarkerClick(post));
          overlay.setMap(map);
          overlaysRef.current.set(post.id, overlay);
        }
      } else {
        overlay = new HTMLMarker(post, isViewed, isHighlighted, () => onMarkerClick(post));
        overlay.setMap(map);
        overlaysRef.current.set(post.id, overlay);
      }
    });
  }, [posts, viewedPostIds, highlightedPostId, onMarkerClick]);

  return <div ref={mapElement} className="w-full h-full bg-gray-100" />;
};

export default MapContainer;