"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const HeaderAdBanner = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 mx-4 h-10 bg-black rounded-xl overflow-hidden relative group cursor-pointer shadow-md border border-white/10"
      onClick={() => window.open('https://www.bmw.co.kr', '_blank')}
    >
      {/* Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=400&q=80" 
        alt="BMW Ad"
        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
      />
      
      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/40 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {/* Shine Effect Overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none shine-overlay opacity-30" />
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm relative z-20">

            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg" 
              alt="BMW Logo" 
              className="w-full h-full object-contain" 
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-white leading-none tracking-tighter uppercase">The New i7</span>
            <span className="text-[6px] font-bold text-white/60 leading-none mt-0.5">Pure Luxury</span>
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