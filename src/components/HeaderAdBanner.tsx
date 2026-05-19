"use client";

import React from 'react';
import { Mail } from 'lucide-react';
import { useAd, resolveActiveSlot, RECRUITMENT_SLOT, normalizeUrl } from '@/hooks/use-ad';
import { getOptimizedBannerImage, getOptimizedMarkerImage } from '@/lib/utils';

// 광고 배너를 자체 GPU 합성 레이어로 분리한다.
// 안드로이드 WebView에서 Radix Dialog가 body에 인라인 스타일(pointer-events, data-scroll-locked 등)을
// 추가/제거할 때 전체 페인트 트리가 재계산되면서 헤더의 그라데이션 배경이 한 프레임 누락되어
// 깜빡거리는 현상이 있어 GPU 합성으로 분리해 영향을 차단한다.
const GPU_LAYER_STYLE: React.CSSProperties = {
  willChange: 'transform',
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
};

const HeaderAdBanner = () => {
  const { ad, loading, now } = useAd('header');

  if (loading) {
    return (
      <div className="flex-1 min-w-0 h-10 bg-gray-100 rounded-xl animate-pulse" />
    );
  }

  // 광고가 없거나 비활성이면 구인 슬롯 사용
  // 시작 시간 전(isPending) 슬롯은 표시할 콘텐츠가 없으므로 광고 문의 배너로 폴백한다.

  const resolvedSlot = ad && ad.is_active ? resolveActiveSlot(ad, now) : RECRUITMENT_SLOT;
  const slot = resolvedSlot.isPending ? RECRUITMENT_SLOT : resolvedSlot;

  // 구인 슬롯인 경우 별도 UI
  if (slot.isRecruitment) {
    return (
      <div
        className="flex-1 min-w-0 h-10 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 rounded-xl overflow-hidden relative group cursor-pointer shadow-sm border border-amber-300/60"
        style={GPU_LAYER_STYLE}
        onClick={() => window.open('mailto:support@hibubblez.com', '_blank')}
      >
        <div className="absolute inset-0 flex items-center justify-center">

          <div className="flex flex-col items-left">
            <span className="text-[8px] font-black text-gray-900 leading-none tracking-tighter uppercase">광고 문의</span>
            <span className="text-[6px] font-bold text-amber-600 leading-none mt-0.5 tracking-[-0.08em]">support@hibubblez.com</span>
          </div>
        </div>

        <Mail className="absolute top-2 right-2.5 w-2.5 h-2.5 text-amber-600" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-w-0 h-10 bg-black rounded-xl overflow-hidden relative group cursor-pointer shadow-md border border-white/10"
      style={GPU_LAYER_STYLE}
      onClick={() => slot.link_url && window.open(normalizeUrl(slot.link_url), '_blank')}
    >
      {/* Background Image */}

      <img
        key={slot.image_url}
        src={getOptimizedBannerImage(slot.image_url, 'header-ad')}
        alt={slot.brand_name || 'Ad'}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-70 group-hover:scale-110 transition-transform duration-700"
      />

      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <div className="absolute inset-0 z-10 pointer-events-none shine-overlay opacity-30" />
          {slot.brand_logo_url && (
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm relative z-20">
              <img
                src={getOptimizedMarkerImage(slot.brand_logo_url, 'header-ad-logo')}
                alt={slot.brand_name || 'Brand'}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-white leading-none tracking-tighter uppercase">{slot.title}</span>
            <span className="text-[6px] font-bold text-white/60 leading-none mt-0.5">{slot.subtitle}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(HeaderAdBanner);
