"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from '@/hooks/use-ad';
import { getOptimizedBannerImage, getOptimizedMarkerImage } from '@/lib/utils';
import { HiBubbleIcon, HiBubbleWordmark } from '@/components/HiBubbleBrand';

const SplashScreen = () => {

  const { ad, loading, now } = useAd('splash');

  // 기간 기반으로 현재 or 다음 광고 슬롯 결정
  // - 광고가 없거나 비활성이면 구인 슬롯 사용
  // - 시작 시간 전(isPending) 슬롯은 스플래시에 표시할 콘텐츠가 없으므로
  //   "광고 준비 중" 회색 박스 대신 광고 문의 배너(RECRUITMENT_SLOT)를 보여준다.
  const slot = !loading
    ? (() => {
        if (!ad || !ad.is_active) return RECRUITMENT_SLOT;
        const resolved = resolveActiveSlot(ad, now);
        if (resolved.isPending) return RECRUITMENT_SLOT;
        return resolved;
      })()
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
          animate={{ scale: 1.2, opacity: 0.25 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-400 blur-3xl rounded-full"
        />

        <div className="relative flex flex-col items-center gap-6 w-full">
          {/* Logo Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.4
            }}
            className="h-[101px] w-[101px] drop-shadow-2xl"
          >
            <HiBubbleIcon className="h-full w-full" />
          </motion.div>

          {/* Brand Name */}
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <HiBubbleWordmark className="text-5xl" />
            </motion.div>
            
            <motion.p

              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="text-[10px] font-bold text-gray-400 mt-3 tracking-widest uppercase"
            >
              Be here, Be seen.
            </motion.p>
          </div>

          {/* 광고 슬롯 — 만료 시 구인 배너 표시 */}

          {slot && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className="mt-10 w-full max-w-[360px] cursor-pointer"
              onClick={() => slot.link_url && window.open(normalizeUrl(slot.link_url), '_blank', 'noopener,noreferrer')}
            >
              {slot.isRecruitment ? (
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 rounded-[28px] shadow-2xl shadow-amber-200/40 border border-white/80 relative overflow-hidden p-5 flex flex-col justify-between">
                  <div className="absolute -top-10 -right-10 w-36 h-36 bg-yellow-300/35 rounded-full" />
                  <div className="absolute top-5 right-5 w-16 h-16 bg-white/55 rounded-full blur-sm" />

                  <div className="relative flex items-center justify-between">
                    <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-black text-amber-700 tracking-wide shadow-sm border border-amber-200/70">
                      광고 문의
                    </span>
                    <Mail className="w-5 h-5 text-amber-600" />
                  </div>

                  <div className="relative flex flex-col gap-1.5">
                    <h2 className="text-[25px] font-black text-gray-950 leading-[1.05] tracking-tight">
                      좋은 브랜드를<br />기다리고 있어요
                    </h2>
                    <p className="text-[13px] font-bold text-amber-700 leading-snug">
                      하이버블 스플래시에서 브랜드를 알려보세요.
                    </p>
                  </div>

                  <div className="relative flex items-center gap-2.5 bg-white/80 rounded-2xl px-3.5 py-2.5 border border-amber-200/70 shadow-sm">
                    <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="flex-1 text-[13px] font-black text-gray-950 tracking-tight truncate">support@hibubblez.com</span>
                    <div className="w-7 h-7 bg-yellow-300 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-3.5 h-3.5 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="relative aspect-[16/9] rounded-[28px] overflow-hidden shadow-[0_22px_50px_rgba(15,23,42,0.28)] border border-white/70 bg-slate-950 group">
                  <img
                    src={getOptimizedBannerImage(slot.image_url, 'splash-ad')}
                    alt={slot.brand_name}
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

                  <div className="relative z-10 h-full p-5 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-gray-950 tracking-[0.16em] shadow-sm">
                        AD
                      </span>
                      {slot.brand_logo_url && (
                        <div className="w-11 h-11 bg-white rounded-2xl p-1.5 shadow-lg shrink-0">
                          <img
                            src={getOptimizedMarkerImage(slot.brand_logo_url, 'splash-ad-logo')}
                            alt={slot.brand_name}
                            loading="eager"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {slot.title && (
                          <h2 className="text-[23px] font-black text-white leading-[1.08] tracking-tight drop-shadow-lg break-keep">
                            {slot.title}
                          </h2>
                        )}
                        {slot.subtitle && (
                          <p className="mt-1.5 text-[13px] font-bold text-white/90 leading-snug drop-shadow-md break-keep">
                            {slot.subtitle}
                          </p>
                        )}
                      </div>

                      {slot.link_url && (
                        <div className="shrink-0 w-9 h-9 rounded-2xl bg-white text-gray-950 flex items-center justify-center shadow-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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
          className="w-full h-full bg-yellow-400"
        />
      </div>
    </motion.div>
  );
};

export default SplashScreen;