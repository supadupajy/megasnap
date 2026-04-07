"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';

// Custom Marker Icon using DivIcon to match previous design
const createCustomIcon = (image: string, isViewed: boolean) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110">
        <div class="w-14 h-14 rounded-2xl border-4 shadow-lg overflow-hidden bg-gray-200 transition-all duration-500 ${
          isViewed 
            ? "grayscale brightness-50 border-gray-500 opacity-80 scale-90" 
            : "grayscale-0 brightness-100 border-white opacity-100 scale-100"
        }">
          <img src="${image}" alt="marker" class="w-full h-full object-cover" />
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 shadow-sm transition-colors duration-500 ${
          isViewed ? "bg-gray-500" : "bg-white"
        }"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

interface MapEventsProps {
  onMapChange: (data: any) => void;
}

const MapEvents = ({ onMapChange }: MapEventsProps) => {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onMapChange({
        bounds: {
          ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
          sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng }
        }
      });
    },
    zoomend: () => {
      const bounds = map.getBounds();
      onMapChange({
        bounds: {
          ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
          sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng }
        }
      });
    }
  });

  // Initial bounds report
  useEffect(() => {
    const bounds = map.getBounds();
    onMapChange({
      bounds: {
        ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng }
      }
    });
  }, []);

  return null;
};

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<number>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
}

const LeafletMapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange }: MapContainerProps) => {
  const center: [number, number] = [37.5665, 126.9780];

  return (
    <div className="w-full h-full bg-gray-100">
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapEvents onMapChange={onMapChange} />
        {posts.map((post) => (
          <Marker
            key={post.id}
            position={[post.lat, post.lng]}
            icon={createCustomIcon(post.image, viewedPostIds.has(post.id))}
            eventHandlers={{
              click: () => onMarkerClick(post),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default LeafletMapContainer;