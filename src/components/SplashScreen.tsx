"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { useAd } from '@/hooks/use-ad';

const SplashScreen = () => {
  const { ad } = useAd('splash');

  const imageUrl = ad?.image_url || 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80';
  const title = ad?.title || 'The New i7';
  const subtitle = ad?.subtitle || 'This is Forwardism.';
  const brandName = ad?.brand_name || 'BMW';
  const brandLogoUrl = ad?.brand_logo_url || 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg';
  const linkUrl = ad?.link_url || 'https://www.bmw.co.kr';
  const isActive = ad?.is_active !== false;

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

          {/* Ad Image */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-12 w-full max-w-[320px] aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl border border-gray-100 relative group cursor-pointer"
              onClick={() => linkUrl && window.open(linkUrl, '_blank', 'noopener,noreferrer')}
            >
              <img 
                src={imageUrl}
                alt={brandName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{title}</span>
                    <span className="text-[8px] font-bold text-white/70">{subtitle}</span>
                  </div>
                  {brandLogoUrl && (
                    <div className="w-7 h-7 bg-white rounded-full p-1 shadow-sm">
                      <img 
                        src={brandLogoUrl}
                        alt={brandName}
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
