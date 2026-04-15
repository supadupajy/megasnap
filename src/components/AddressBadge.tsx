"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddressBadgeProps {
  lat: number;
  lng: number;
}

const AddressBadge = ({ lat, lng }: AddressBadgeProps) => {
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const lastCoords = useRef({ lat: 0, lng: 0 });

  useEffect(() => {
    // 좌표 변화가 미미하면 요청하지 않음 (약 10m 이내)
    const dist = Math.sqrt(Math.pow(lat - lastCoords.current.lat, 2) + Math.pow(lng - lastCoords.current.lng, 2));
    if (dist < 0.0001 && address) return;

    if (!window.google || !window.google.maps || !lat || !lng) return;

    const timer = setTimeout(() => {
      setIsLoading(true);
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          setIsLoading(false);
          if (status === "OK" && results && results[0]) {
            lastCoords.current = { lat, lng };
            
            const components = results[0].address_components;
            let city = "";
            let district = "";
            let neighborhood = "";

            // 한국 주소 체계에 맞는 정교한 추출
            for (const component of components) {
              const types = component.types;
              if (types.includes("administrative_area_level_1")) city = component.long_name;
              if (types.includes("sublocality_level_1") || types.includes("locality")) district = component.long_name;
              if (types.includes("sublocality_level_2") || types.includes("neighborhood")) neighborhood = component.long_name;
            }

            // 결과 조합
            let formatted = [city, district, neighborhood].filter(Boolean).join(" ");
            
            // 만약 추출된 값이 너무 짧으면 전체 주소에서 앞부분 추출
            if (!formatted || formatted.length < 5) {
              const parts = results[0].formatted_address.split(" ");
              // '대한민국' 제외하고 3단어 추출
              formatted = parts.filter(p => p !== '대한민국').slice(0, 3).join(" ");
            }

            setAddress(formatted);
          } else {
            console.error("Geocode failed:", status);
            // 실패 시 좌표라도 표시하여 사용자 피드백 제공
            setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        }
      );

      return () => clearTimeout(timer);
    }, 800); // 디바운스 시간 소폭 증가 (안정성)

    return () => clearTimeout(timer);
  }, [lat, lng]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-center mt-3"
    >
      <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-indigo-50 flex items-center gap-2.5 pointer-events-auto">
        <div className="w-5 h-5 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          ) : (
            <MapPin className="w-3 h-3 text-white fill-white" />
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.span 
            key={address}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[11px] font-black text-gray-700 tracking-tight"
          >
            {address || "주변 위치 탐색 중..."}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AddressBadge;