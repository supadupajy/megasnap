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
  const retryCount = useRef(0);

  const cleanName = (name: string) => {
    if (!name) return "";
    return name
      .replace("서울특별시", "서울시")
      .replace("부산광역시", "부산시")
      .replace("대구광역시", "대구시")
      .replace("인천광역시", "인천시")
      .replace("광주광역시", "광주시")
      .replace("대전광역시", "대전시")
      .replace("울산광역시", "울산시")
      .replace("세종특별자치시", "세종시")
      .replace("제주특별자치도", "제주도")
      .replace("경기도", "경기")
      .replace("강원특별자치도", "강원")
      .replace("충청북도", "충북")
      .replace("충청남도", "충남")
      .replace("전라북도", "전북")
      .replace("전라남도", "전남")
      .replace("경상북도", "경북")
      .replace("경상남도", "경남");
  };

  const fetchAddress = () => {
    if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
      if (retryCount.current < 5) {
        retryCount.current++;
        setTimeout(fetchAddress, 500);
      }
      return;
    }

    setIsLoading(true);
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode(
      { location: { lat, lng }, language: 'ko' },
      (results, status) => {
        setIsLoading(false);
        if (status === "OK" && results && results[0]) {
          retryCount.current = 0;
          lastCoords.current = { lat, lng };
          
          const components = results[0].address_components;
          let city = "";
          let gu = "";
          let dong = "";

          for (const component of components) {
            const types = component.types;
            if (types.includes("administrative_area_level_1")) city = cleanName(component.long_name);
            if (types.includes("sublocality_level_1") || types.includes("locality")) gu = component.long_name;
            if (types.includes("sublocality_level_2")) dong = component.long_name;
          }

          let formatted = [city, gu, dong].filter(Boolean).join(" ");
          
          if (!formatted || formatted.length < 3) {
            // 폴백: formatted_address에서 직접 추출
            const parts = results[0].formatted_address.split(" ");
            formatted = parts.filter(p => 
              p !== '대한민국' && 
              !p.includes('+') && 
              !/^\d/.test(p) // 숫자로 시작하는 번지수 제외
            ).slice(0, 3).join(" ");
          }

          setAddress(formatted || "위치 정보 확인됨");
        } else if (status === "OVER_QUERY_LIMIT") {
          // 쿼리 제한 시 잠시 후 재시도
          setTimeout(fetchAddress, 2000);
        } else {
          console.warn("Geocoder failed due to: " + status);
          if (!address) setAddress("위치 탐색 중...");
        }
      }
    );
  };

  useEffect(() => {
    if (lat === 0 && lng === 0) return;

    const dist = Math.sqrt(Math.pow(lat - lastCoords.current.lat, 2) + Math.pow(lng - lastCoords.current.lng, 2));
    if (dist < 0.0001 && address) return;

    const timer = setTimeout(fetchAddress, 600);
    return () => clearTimeout(timer);
  }, [lat, lng]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-center mt-3"
    >
      <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-indigo-50 flex items-center gap-2.5 pointer-events-auto min-w-[140px] justify-center">
        <div className="w-5 h-5 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          ) : (
            <MapPin className="w-3 h-3 text-white fill-white" />
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.span 
            key={address || 'loading'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[11px] font-black text-gray-700 tracking-tight"
          >
            {address || "위치 탐색 중..."}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AddressBadge;