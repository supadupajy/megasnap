"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAd } from '@/hooks/use-ad';

const HeaderAdBanner = () => {
  const { ad, loading } = useAd('header');

  if (loading) {
    return (
      <div className="flex-1 mx-4 h-10 bg-gray-100 rounded-xl animate-pulse" />
    );
  }

  if (!ad || !ad.is_active) return null;

  const imageUrl = ad.image_url || 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=400&q=80';
  const title = ad.title || 'The New i7';
  const subtitle = ad.subtitle || 'Pure Luxury';
  const linkUrl = ad.link_url || 'https://www.bmw.co.kr';
  const brandLogoUrl = ad.brand_logo_url;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 mx-4 h-10 bg-black rounded-xl overflow-hidden relative group cursor-pointer shadow-md border border-white/10"
      onClick={() => linkUrl && window.open(linkUrl, '_blank')}
    >
      {/* Background Image */}
      <img 
        src={imageUrl}
        alt={ad.brand_name || 'Ad'}
        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
      />
      
      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/40 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="absolute inset-0 z-10 pointer-events-none shine-overlay opacity-30" />
          {brandLogoUrl && (
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm relative z-20">
              <img 
                src={brandLogoUrl}
                alt={ad.brand_name || 'Brand'}
                className="w-full h-full object-contain" 
              />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-white leading-none tracking-tighter uppercase">{title}</span>
            <span className="text-[6px] font-bold text-white/60 leading-none mt-0.5">{subtitle}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 group-hover:bg-white/20 transition-colors">
          <span className="text-[7px] font-black text-white uppercase">Link</span>
          <ExternalLink className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

export default HeaderAdBanner;
