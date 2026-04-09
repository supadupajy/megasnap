"use client";

import React from 'react';
import GoogleMapReact from 'google-map-react';
import { cn } from '@/lib/utils';

interface MarkerProps {
  lat: number;
  lng: number;
  image: string;
  isViewed: boolean;
  onClick: () => void;
}

const Marker = ({ image, isViewed, onClick }: MarkerProps) => (
  <div 
    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-110 z-10"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
  >
    <div className={cn(
      "w-14 h-14 rounded-2xl border-4 shadow-lg overflow-hidden bg-gray-200 transition-all duration-500",
      isViewed 
        ? "grayscale brightness-50 border-gray-500 opacity-80 scale-90" 
        : "grayscale-0 brightness-100 border-white opacity-100 scale-100"
    )}>
      <img src={image} alt="marker" className="w-full h-full object-cover" />
    </div>
    <div className={cn(
      "absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 shadow-sm transition-colors duration-500",
      isViewed ? "bg-gray-500" : "bg-white"
    )} />
  </div>
);

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<number>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
}

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange }: MapContainerProps) => {
  const defaultProps = {
    center: { lat: 37.5665, lng: 126.9780 },
    zoom: 14
  };

  const mapOptions = {
    disableDefaultUI: true,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    ],
    gestureHandling: "greedy"
  };

  return (
    <div className="w-full h-full bg-gray-100">
      <GoogleMapReact
        bootstrapURLKeys={{ key: "" }} // API 키 없이 개발 모드로 작동
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
        options={mapOptions}
        onChange={onMapChange}
        yesIWantToUseGoogleMapApiInternals
      >
        {posts.map((post) => (
          <Marker
            key={post.id}
            lat={post.lat}
            lng={post.lng}
            image={post.image}
            isViewed={viewedPostIds.has(post.id)}
            onClick={() => onMarkerClick(post)}
          />
        ))}
      </GoogleMapReact>
    </div>
  );
};

export default MapContainer;