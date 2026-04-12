"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

const SplashScreen = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center"
    >
      <div className="relative">
        {/* Background Glow */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.15 }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
          className="absolute inset-0 bg-green-500 blur-3xl rounded-full"
        />

        <div className="relative flex flex-col items-center gap-6">
          {/* Logo Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2
            }}
            className="w-24 h-24 bg-green-500 rounded-[32px] flex items-center justify-center shadow-2xl shadow-green-200"
          >
            <Camera className="w-12 h-12 text-white" strokeWidth={2.5} />
          </motion.div>

          {/* Brand Name */}
          <div className="flex flex-col items-center">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-4xl font-black text-gray-900 tracking-tighter"
            >
              Mega<span className="text-green-500">Snap</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="text-sm font-bold text-gray-400 mt-2 tracking-widest uppercase"
            >
              Capture the Moment
            </motion.p>
          </div>
        </div>
      </div>

      {/* Loading Bar */}
      <div className="absolute bottom-20 w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 1.5, ease: "linear" }}
          className="w-full h-full bg-green-500"
        />
      </div>
    </motion.div>
  );
};

export default SplashScreen;