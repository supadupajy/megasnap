"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { useAd, resolveActiveSlot } from '@/hooks/use-ad';

const SplashScreen = () => {
  const { ad, loading, now } = useAd('splash');

  // 기간 기반으로 현재 or 다음 광고 슬롯 결정 (now가 바뀌면 자동 재계산)
  const slot = ad ? resolveActiveSlot(ad, now) : null;
  const showAd = !loading && ad?.is_active && !!slot?.image_url;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeIn" }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center px-6"
    >

      <div className="relative w-full flex flex-col items-center">
        {/* Background Glow */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.15 }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600 blur-3xl rounded-full"
        />

        <div className="relative flex flex-col items-center gap-6 w-full">
          {/* Logo Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.4
            }}
            className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-indigo-200"
          >
            <Camera className="w-10 h-10 text-white" strokeWidth={2.5} />
          </motion.div>

          {/* Brand Name */}
          <div className="flex flex-col items-center">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-4xl font-black text-gray-900 tracking-tighter italic"
            >
              Chora<span className="text-indigo-600">Snap</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="text-[10px] font-bold text-gray-400 mt-1 tracking-widest uppercase"
            >
              Be here. Be seen.
            </motion.p>
          </div>

          {/* 광고 — 기간 기반으로 현재/다음 슬롯 자동 선택 */}
          {showAd && slot && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-12 w-full max-w-[320px] aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl border border-gray-100 relative group cursor-pointer"
              onClick={() => slot.link_url && window.open(slot.link_url, '_blank', 'noopener,noreferrer')}
            >
              <img 
                src={slot.image_url}
                alt={slot.brand_name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    {slot.title && <span className="text-[10px] font-black text-white uppercase tracking-tighter">{slot.title}</span>}
                    {slot.subtitle && <span className="text-[8px] font-bold text-white/70">{slot.subtitle}</span>}
                  </div>
                  {slot.brand_logo_url && (
                    <div className="w-7 h-7 bg-white rounded-full p-1 shadow-sm">
                      <img 
                        src={slot.brand_logo_url}
                        alt={slot.brand_name}
                        className="w-full h-full object-contain" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Loading Bar */}
      <div className="absolute bottom-20 w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 2.5, ease: "easeInOut", delay: 0.5 }}
          className="w-full h-full bg-indigo-600"
        />
      </div>
    </motion.div>
  );
};

export default SplashScreen;
