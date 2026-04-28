"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT } from '@/hooks/use-ad';

const SearchAdBanner = () => {
  const { ad, loading, now } = useAd('search');

  if (loading) {
    return <div className="h-[120px] w-full rounded-[24px] bg-gray-100 animate-pulse mb-8" />;
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-black/10"
        onClick={() => window.open('mailto:chorasnap@gmail.com', '_blank')}
      >
        <img
          src={slot.image_url}
          alt="광고 문의"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-black/10 bg-zinc-900"
      onClick={() => slot.link_url && window.open(slot.link_url, '_blank', 'noopener,noreferrer')}
    >
      {/* Background Image */}
      <img
        key={slot.image_url}
        src={slot.image_url}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90"
        alt={slot.brand_name}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex flex-col justify-center px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/90 text-black text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm">AD</span>
          {!slot.brand_logo_url && (
            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">{slot.brand_name}</span>
          )}
        </div>
        
        <h3 className="text-white font-black text-xl leading-tight mb-1 tracking-tighter uppercase italic drop-shadow-lg">
          {slot.title}
        </h3>
        
        <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-bold group-hover:text-white transition-colors">
          {slot.subtitle} <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* 브랜드 로고 */}
      {slot.brand_logo_url && (
        <div className="absolute bottom-3 right-4 pointer-events-none">
          <img
            src={slot.brand_logo_url}
            alt={slot.brand_name}
            className="h-10 w-auto object-contain drop-shadow-lg"
          />
        </div>
      )}

      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SearchAdBanner;
