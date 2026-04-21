"use client";

import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const SearchAdBanner = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative h-[120px] w-full rounded-[24px] overflow-hidden mb-8 group cursor-pointer shadow-lg shadow-black/10 bg-zinc-900"
    >
      {/* Background Image - The North Face */}
      <img 
        src="/assets/northface-ad-banner.png" 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90"
        alt="The North Face Ad"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex flex-col justify-center px-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/90 text-black text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm">AD</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">The North Face</span>
          </div>
        </div>
        
        <h3 className="text-white font-black text-xl leading-tight mb-1 tracking-tighter uppercase italic drop-shadow-lg">
          Never Stop Exploring.
        </h3>
        
        <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-bold group-hover:text-white transition-colors">
          Summit Series 2026 <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {/* Decorative Element */}
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SearchAdBanner;