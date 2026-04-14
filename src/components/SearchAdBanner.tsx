"use client";

import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const SearchAdBanner = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-indigo-100/50"
    >
      {/* Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80" 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        alt="Ad Background"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/80 via-indigo-900/40 to-transparent flex flex-col justify-center px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-yellow-400 text-black text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm">AD</span>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">Premium Pick</span>
          </div>
        </div>
        
        <h3 className="text-white font-black text-lg leading-tight mb-1 tracking-tight">
          최고의 순간을 위한<br/>프로 작가의 보정 프리셋
        </h3>
        
        <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-bold group-hover:text-white transition-colors">
          지금 무료로 다운로드 <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* Decorative Element */}
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-indigo-600/20 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SearchAdBanner;