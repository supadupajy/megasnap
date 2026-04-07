"use client";

import React from 'react';
import GoogleMapReact from 'google-map-react';
import { cn } from '@/lib/utils';

interface MapMarkerProps {
  lat: number;
  lng: number;
  image: string;
  isViewed: boolean;
  onClick?: () => void;
}

const MapMarker = ({ image, isViewed, onClick }: MapMarkerProps) => (
  <div 
    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-110 z-10"
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
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

interface GoogleMapContainerProps {
  posts: any[];
  viewedPostIds: Set<number>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
}

const GoogleMapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange }: GoogleMapContainerProps) => {
  const defaultProps = {
    center: { lat: 37.5665, lng: 126.9780 },
    zoom: 14
  };

  const mapStyles = [
    { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
  ];

  return (
    <div className="w-full h-full bg-gray-100">
      <GoogleMapReact
        bootstrapURLKeys={{ key: "", language: 'ko', region: 'KR' }}
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
        yesIWantToUseGoogleMapApiInternals
        onChange={onMapChange}
        options={{
          disableDefaultUI: true,
          styles: mapStyles,
          gestureHandling: 'greedy'
        }}
      >
        {posts.map((post) => (
          <MapMarker
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

export default GoogleMapContainer;