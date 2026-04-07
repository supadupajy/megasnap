"use client";

import React from 'react';
import GoogleMapReact from 'google-map-react';

interface MapMarkerProps {
  lat: number;
  lng: number;
  image: string;
  onClick?: () => void;
}

const MapMarker = ({ image, onClick }: MapMarkerProps) => (
  <div 
    className="relative transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 z-10"
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
  >
    <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gray-200">
      <img src={image} alt="marker" className="w-full h-full object-cover" />
    </div>
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 shadow-sm" />
  </div>
);

interface GoogleMapContainerProps {
  posts: any[];
  onMarkerClick: (post: any) => void;
}

const GoogleMapContainer = ({ posts, onMarkerClick }: GoogleMapContainerProps) => {
  const defaultProps = {
    center: {
      lat: 37.5665,
      lng: 126.9780
    },
    zoom: 14
  };

  return (
    <div className="w-full h-full">
      <GoogleMapReact
        bootstrapURLKeys={{ key: "" }}
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
        options={{
          disableDefaultUI: true,
          styles: [
            {
              "featureType": "poi",
              "elementType": "labels",
              "stylers": [{ "visibility": "off" }]
            }
          ]
        }}
      >
        {posts.map((post) => (
          <MapMarker
            key={post.id}
            lat={post.lat}
            lng={post.lng}
            image={post.image}
            onClick={() => onMarkerClick(post)}
          />
        ))}
      </GoogleMapReact>
    </div>
  );
};

export default GoogleMapContainer;