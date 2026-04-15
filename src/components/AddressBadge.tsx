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
  const lastRequestTime = useRef(0);

  useEffect(() => {
    if (!window.google || !lat || !lng) return;

    // API 호출 과부하 방지를 위한 디바운싱 (500ms)
    const timer = setTimeout(() => {
      const now = Date.now();
      if (now - lastRequestTime.current < 500) return;
      
      setIsLoading(true);
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          setIsLoading(false);
          if (status === "OK" && results && results[0]) {
            lastRequestTime.current = Date.now();
            
            // 행정 구역 추출 (시, 구, 동 위주)
            const components = results[0].address_components;
            let city = "";
            let district = "";
            let neighborhood = "";

            for (const component of components) {
              const types = component.types;
              if (types.includes("administrative_area_level_1")) city = component.long_name;
              if (types.includes("sublocality_level_1") || types.includes("locality")) district = component.long_name;
              if (types.includes("sublocality_level_2")) neighborhood = component.long_name;
            }

            // 결과 조합 (예: 서울특별시 강남구 역삼동)
            const formatted = [city, district, neighborhood].filter(Boolean).join(" ");
            setAddress(formatted || results[0].formatted_address.split(" ").slice(1, 4).join(" "));
          }
        }
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [lat, lng]);

  return (
    <div className="flex justify-center w-full pointer-events-none">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-indigo-100 flex items-center gap-2 pointer-events-auto"
      >
        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-white fill-white" />
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.span 
            key={address}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            className="text-xs font-black text-gray-800 whitespace-nowrap"
          >
            {address || "위치 확인 중..."}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AddressBadge;