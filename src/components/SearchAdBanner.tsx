"use client";

import React from 'react';
import { ExternalLink, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from '@/hooks/use-ad';
import { getOptimizedBannerImage, getOptimizedMarkerImage } from '@/lib/utils';

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
        className="w-full h-[120px] bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 rounded-[24px] mb-8 shadow-sm shadow-amber-100 border border-amber-200/60 cursor-pointer relative overflow-hidden px-5 py-4 flex flex-col justify-between"
        onClick={() => window.open('mailto:tocatoca@gmail.com', '_blank')}
      >
        {/* 장식 원형 */}
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-yellow-300/30 rounded-full pointer-events-none" />
        <div className="absolute -top-2 -right-2 w-16 h-16 bg-amber-300/30 rounded-full pointer-events-none" />
        {/* 상단 레이블 */}
        <span className="text-[11px] font-bold text-amber-600 tracking-wide">광고 문의</span>
        {/* 메인 카피 */}
        <div>
          <h2 className="text-[16px] font-black text-gray-900 leading-tight tracking-tight">
            좋은 브랜드를 기다리고 있어요.
          </h2>
          <p className="text-[11px] font-medium text-amber-700 mt-0.5">광고 문의는 언제든 환영이에요.</p>
        </div>
        {/* 이메일 버튼 */}
        <div className="flex items-center gap-2.5 bg-white/70 rounded-xl px-3 py-2 border border-amber-200/60">
          <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="flex-1 text-[12px] font-bold text-gray-900 tracking-tight">tocatoca@gmail.com</span>
          <div className="w-5 h-5 bg-yellow-200 rounded-lg flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-black/10 bg-zinc-900"
      onClick={() => slot.link_url && window.open(normalizeUrl(slot.link_url), '_blank', 'noopener,noreferrer')}
    >
      {/* Background Image */}
      <img
        key={slot.image_url}
        src={getOptimizedBannerImage(slot.image_url, 'search-ad')}
        loading="lazy"
        decoding="async"
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
            src={getOptimizedMarkerImage(slot.brand_logo_url, 'search-ad-logo')}
            alt={slot.brand_name}
            loading="lazy"
            decoding="async"
            className="h-10 w-auto object-contain drop-shadow-lg"
          />
        </div>
      )}

      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SearchAdBanner;
