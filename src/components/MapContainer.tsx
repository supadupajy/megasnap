"use client";

import React from 'react';
import GoogleMapReact from 'google-map-react';
import { cn } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

// 커스텀 마커 컴포넌트
const Marker = ({ post, isViewed, onClick }: { post: any, isViewed: boolean, onClick: () => void }) => {
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  
  const pinColor = (isInfluencer || isPopular) 
    ? (isViewed ? 'bg-slate-400' : (isInfluencer ? 'bg-yellow-400' : 'bg-red-500')) 
    : (isAd ? 'bg-blue-500' : (isViewed ? 'bg-slate-400' : 'bg-white'));

  return (
    <div 
      className="relative -translate-x-1/2 -translate-y-full cursor-pointer group"
      onClick={onClick}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl p-1 shadow-xl transition-all duration-300 group-hover:scale-110",
        pinColor,
        isInfluencer && !isViewed && "animate-influencer-glow",
        isPopular && !isViewed && "animate-popular-glow",
        isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : ''),
        isViewed && "viewed"
      )}>
        <div className="w-full h-full rounded-xl overflow-hidden bg-white relative">
          <img 
            src={post.image} 
            alt="" 
            className={cn(
              "w-full h-full object-cover",
              isViewed && "grayscale-[0.5] brightness-[0.8]"
            )} 
          />
        </div>
      </div>
      {/* Pin Tail */}
      <div className={cn(
        "absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45",
        pinColor
      )} />
    </div>
  );
};

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, center }: MapContainerProps) => {
  const defaultProps = {
    center: {
      lat: 37.5665,
      lng: 126.9780
    },
    zoom: 15
  };

  const handleMapChange = ({ center, zoom, bounds }: any) => {
    onMapChange({
      bounds: {
        sw: { lat: bounds.sw.lat, lng: bounds.sw.lng },
        ne: { lat: bounds.ne.lat, lng: bounds.ne.lng }<dyad-write path="src/components/MapContainer.tsx" description="네이버 지도를 구글 맵(Google Maps)으로 교체하고 기존 마커 디자인 적용">
"use client";

import React from 'react';
import GoogleMapReact from 'google-map-react';
import { cn } from '@/lib/utils';

interface MapContainerProps {
  posts: any[];
  viewedPostIds: Set<any>;
  onMarkerClick: (post: any) => void;
  onMapChange: (data: any) => void;
  onMapWriteClick: () => void;
  center?: { lat: number; lng: number };
}

// 커스텀 마커 컴포넌트
const Marker = ({ post, isViewed, onClick }: { post: any, isViewed: boolean, onClick: () => void, lat: number, lng: number }) => {
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  
  const pinColor = (isInfluencer || isPopular) 
    ? (isViewed ? 'bg-slate-400' : (isInfluencer ? 'bg-yellow-400' : 'bg-red-500')) 
    : (isAd ? 'bg-blue-500' : (isViewed ? 'bg-slate-400' : 'bg-white'));

  return (
    <div 
      className="relative -translate-x-1/2 -translate-y-full cursor-pointer group z-10"
      onClick={onClick}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl p-1 shadow-xl transition-all duration-300 group-hover:scale-110",
        pinColor,
        isInfluencer && !isViewed && "animate-influencer-glow",
        isPopular && !isViewed && "animate-popular-glow",
        isInfluencer ? 'influencer-border-container' : (isPopular ? 'popular-border-container' : ''),
        isViewed && "viewed"
      )}>
        <div className="w-full h-full rounded-xl overflow-hidden bg-white relative">
          <img 
            src={post.image} 
            alt="" 
            className={cn(
              "w-full h-full object-cover",
              isViewed && "grayscale-[0.5] brightness-[0.8]"
            )} 
          />
        </div>
      </div>
      {/* Pin Tail */}
      <div className={cn(
        "absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45",
        pinColor
      )} />
    </div>
  );
};

const MapContainer = ({ posts, viewedPostIds, onMarkerClick, onMapChange, center }: MapContainerProps) => {
  const defaultProps = {
    center: {
      lat: 37.5665,
      lng: 126.9780
    },
    zoom: 15
  };

  const handleMapChange = ({ center, zoom, bounds }: any) => {
    if (bounds) {
      onMapChange({
        bounds: {
          sw: { lat: bounds.sw.lat, lng: bounds.sw.lng },
          ne: { lat: bounds.ne.lat, lng: bounds.ne.lng }
        }
      });
    }
  };

  return (
    <div className="w-full h-full bg-slate-100">
      <GoogleMapReact
        bootstrapURLKeys={{ key: "" }} // API 키 없이도 개발 모드에서 제한적으로 작동하거나 워터마크와 함께 뜹니다.
        defaultCenter={defaultProps.center}
        center={center}
        defaultZoom={defaultProps.zoom}
        onChange={handleMapChange}
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
          <Marker
            key={post.id}
            lat={post.lat}
            lng={post.lng}
            post={post}
            isViewed={viewedPostIds.has(post.id)}
            onClick={() => onMarkerClick(post)}
          />
        ))}
      </GoogleMapReact>
    </div>
  );
};

export default MapContainer;