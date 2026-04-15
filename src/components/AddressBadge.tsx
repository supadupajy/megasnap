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

  // 행정 구역 명칭을 깔끔하게 정리하는 함수
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

  useEffect(() => {
    // 좌표 변화가 아주 미세하면(약 5~10m) 재요청하지 않음
    const dist = Math.sqrt(Math.pow(lat - lastCoords.current.lat, 2) + Math.pow(lng - lastCoords.current.lng, 2));
    if (dist < 0.00008 && address) return;

    if (!window.google || !window.google.maps || !lat || !lng) return;

    const timer = setTimeout(() => {
      setIsLoading(true);
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode(
        { location: { lat, lng }, language: 'ko' },
        (results, status) => {
          setIsLoading(false);
          if (status === "OK" && results && results[0]) {
            lastCoords.current = { lat, lng };
            
            const components = results[0].address_components;
            let city = "";
            let gu = "";
            let dong = "";

            // 구글 주소 컴포넌트에서 시, 구, 동 추출
            for (const component of components) {
              const types = component.types;
              
              // 시/도 (예: 서울특별시, 경기도)
              if (types.includes("administrative_area_level_1")) {
                city = cleanName(component.long_name);
              }
              // 구/시 (예: 서초구, 성남시)
              if (types.includes("sublocality_level_1") || types.includes("locality")) {
                gu = component.long_name;
              }
              // 동/읍/면 (예: 양재동, 정자동)
              if (types.includes("sublocality_level_2")) {
                dong = component.long_name;
              }
            }

            // 결과 조합 (시 구 동)
            let formatted = [city, gu, dong].filter(Boolean).join(" ");
            
            // 만약 추출된 값이 너무 짧거나 비어있으면 formatted_address에서 파싱 시도
            if (!formatted || formatted.length < 3) {
              const parts = results[0].formatted_address.split(" ");
              // '대한민국' 제외하고 앞의 3단어 추출
              formatted = parts.filter(p => p !== '대한민국' && !p.includes('+')).slice(0, 3).join(" ");
            }

            setAddress(formatted);
          } else {
            // 실패 시 좌표 대신 마지막 주소 유지 또는 에러 메시지
            if (!address) setAddress("위치 정보를 불러올 수 없음");
          }
        }
      );
    }, 600);

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