"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAd } from '@/hooks/use-ad';

const SearchAdBanner = () => {
  const { ad, loading } = useAd('search');

  if (loading) {
    return <div className="h-[120px] w-full rounded-[24px] bg-gray-100 animate-pulse mb-8" />;
  }

  if (!ad || !ad.is_active) return null;

  const imageUrl = ad.image_url || '/assets/northface-ad-banner.png';
  const title = ad.title || 'Never Stop Exploring.';
  const subtitle = ad.subtitle || 'Summit Series 2026';
  const linkUrl = ad.link_url || 'https://www.thenorthface.com';
  const brandName = ad.brand_name || 'The North Face';
  const brandLogoUrl = ad.brand_logo_url;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-black/10 bg-zinc-900"
      onClick={() => linkUrl && window.open(linkUrl, '_blank', 'noopener,noreferrer')}
    >
      {/* Background Image */}
      <img 
        src={imageUrl}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90"
        alt={brandName}
      />
      
      {/* Gradient Overlay - 좌측 텍스트 영역 */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex flex-col justify-center px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/90 text-black text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm">AD</span>
          {!brandLogoUrl && (
            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">{brandName}</span>
          )}
        </div>
        
        <h3 className="text-white font-black text-xl leading-tight mb-1 tracking-tighter uppercase italic drop-shadow-lg">
          {title}
        </h3>
        
        <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-bold group-hover:text-white transition-colors">
          {subtitle} <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* 브랜드 로고 - 우측 하단 (배경 없이 PNG 투명도 그대로) */}
      {brandLogoUrl && (
        <div className="absolute bottom-3 right-4 pointer-events-none">
          <img
            src={brandLogoUrl}
            alt={brandName}
            className="h-10 w-auto object-contain drop-shadow-lg"
          />
        </div>
      )}

      {/* Decorative Element */}
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SearchAdBanner;
