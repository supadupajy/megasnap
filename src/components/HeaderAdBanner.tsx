"use client";

import React from 'react';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from '@/hooks/use-ad';

const HeaderAdBanner = () => {
  const { ad, loading, now } = useAd('header');

  if (loading) {
    return (
      <div className="flex-1 max-w-[180px] ml-3 h-10 bg-gray-100 rounded-xl animate-pulse" />
    );
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 max-w-[180px] ml-3 h-10 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl overflow-hidden relative group cursor-pointer shadow-md"
        onClick={() => window.open('mailto:chorasnap@gmail.com', '_blank')}
      >
        <div className="absolute inset-0 flex items-center justify-center gap-2 px-3">
          <Mail className="w-3 h-3 text-white/90 shrink-0 ml-1" />
          <div className="flex flex-col mr-1">
            <span className="text-[8px] font-black text-white leading-none tracking-tighter uppercase">광고 문의</span>
            <span className="text-[6px] font-bold text-white/70 leading-none mt-0.5 tracking-[-0.08em]">chorasnap@gmail.com</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 max-w-[180px] ml-3 h-10 bg-black rounded-xl overflow-hidden relative group cursor-pointer shadow-md border border-white/10"
      onClick={() => slot.link_url && window.open(normalizeUrl(slot.link_url), '_blank')}
    >
      {/* Background Image */}
      <img
        key={slot.image_url}
        src={slot.image_url}
        alt={slot.brand_name || 'Ad'}
        className="absolute inset-0 w-full h-full object-cover object-center opacity-70 group-hover:scale-110 transition-transform duration-700"
      />
      
      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <div className="absolute inset-0 z-10 pointer-events-none shine-overlay opacity-30" />
          {slot.brand_logo_url && (
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm relative z-20">
              <img 
                src={slot.brand_logo_url}
                alt={slot.brand_name || 'Brand'}
                className="w-full h-full object-contain" 
              />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-white leading-none tracking-tighter uppercase">{slot.title}</span>
            <span className="text-[6px] font-bold text-white/60 leading-none mt-0.5">{slot.subtitle}</span>
          </div>
        </div>
        
      </div>
    </motion.div>
  );
};

export default HeaderAdBanner;
