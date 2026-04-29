"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Mail } from 'lucide-react';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from '@/hooks/use-ad';

const SplashScreen = () => {
  const { ad, loading, now } = useAd('splash');

  // 기간 기반으로 현재 or 다음 광고 슬롯 결정
  // 광고가 없거나 비활성이면 구인 슬롯 사용
  const slot = !loading 
    ? (ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT)
    : null;

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

          {/* 광고 슬롯 — 만료 시 구인 배너 표시 */}
          {slot && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-12 w-full max-w-[320px] cursor-pointer"
              onClick={() => slot.link_url && window.open(normalizeUrl(slot.link_url), '_blank', 'noopener,noreferrer')}
            >
              {slot.isRecruitment ? (
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 rounded-2xl shadow-2xl shadow-indigo-200 relative overflow-hidden p-5 flex flex-col justify-between">
                  {/* 장식 원형 */}
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                  <div className="absolute -top-3 -right-3 w-20 h-20 bg-white/10 rounded-full" />
                  {/* 상단 레이블 */}
                  <span className="text-[11px] font-bold text-white/70 tracking-wide">광고 문의</span>
                  {/* 메인 카피 */}
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[22px] font-black text-white leading-tight tracking-tight">
                      좋은 브랜드를<br />기다리고 있어요.
                    </h2>
                    <p className="text-[12px] font-medium text-white/70">광고 문의는 언제든 환영이에요.</p>
                  </div>
                  {/* 이메일 버튼 */}
                  <div className="flex items-center gap-3 bg-white/15 rounded-xl px-3 py-2.5">
                    <Mail className="w-4 h-4 text-white/80 shrink-0" />
                    <span className="flex-1 text-[13px] font-bold text-white tracking-tight">chorasnap@gmail.com</span>
                    <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl border border-gray-100 relative group">
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
                </div>
              )}
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