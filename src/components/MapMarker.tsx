"use client";

import React from 'react';

interface MapMarkerProps {
  top: string;
  left: string;
  imageUrl: string;
}

const MapMarker = ({ top, left, imageUrl }: MapMarkerProps) => {
  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 z-10"
      style={{ top, left }}
    >
      <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gray-200">
        <img src={imageUrl} alt="marker" className="w-full h-full object-cover" />
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 shadow-sm" />
    </div>
  );
};

export default MapMarker;