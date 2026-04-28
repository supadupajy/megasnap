import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdData {
  id: string;
  label: string;
  image_url: string;
  title: string;
  subtitle: string;
  link_url: string;
  brand_name: string;
  brand_logo_url: string;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
  // 현재 광고 기간
  start_date?: string | null;
  end_date?: string | null;
  // 다음 광고
  next_image_url?: string | null;
  next_title?: string | null;
  next_subtitle?: string | null;
  next_link_url?: string | null;
  next_brand_name?: string | null;
  next_brand_logo_url?: string | null;
  next_start_date?: string | null;
  next_end_date?: string | null;
}

// 현재 날짜 기준으로 유효한 광고 슬롯을 반환
// - 현재 광고 기간이 유효하면 현재 광고 반환
// - 기간이 지났고 다음 광고가 있으면 다음 광고를 현재로 승격해서 반환
export function resolveActiveSlot(ad: AdData): {
  image_url: string;
  title: string;
  subtitle: string;
  link_url: string;
  brand_name: string;
  brand_logo_url: string;
  isNext: boolean; // 다음 광고가 현재로 승격된 경우 true
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentExpired =
    ad.end_date != null && new Date(ad.end_date) < today;

  const nextAvailable =
    !!ad.next_image_url &&
    (ad.next_start_date == null || new Date(ad.next_start_date) <= today);

  if (currentExpired && nextAvailable) {
    return {
      image_url: ad.next_image_url!,
      title: ad.next_title || '',
      subtitle: ad.next_subtitle || '',
      link_url: ad.next_link_url || '',
      brand_name: ad.next_brand_name || '',
      brand_logo_url: ad.next_brand_logo_url || '',
      isNext: true,
    };
  }

  return {
    image_url: ad.image_url,
    title: ad.title,
    subtitle: ad.subtitle,
    link_url: ad.link_url,
    brand_name: ad.brand_name,
    brand_logo_url: ad.brand_logo_url,
    isNext: false,
  };
}

// 인메모리 캐시
const adCache: Record<string, AdData> = {};
// 캐시 무효화 리스너
const listeners: Record<string, Set<(data: AdData) => void>> = {};

// AdminAds에서 저장 후 호출해 캐시를 갱신
export function invalidateAdCache(adId: string, updated: AdData) {
  const prev = adCache[adId];
  if (prev && JSON.stringify(prev) === JSON.stringify(updated)) return;
  adCache[adId] = updated;
  listeners[adId]?.forEach(fn => fn(updated));
}

export function useAd(adId: string) {
  const [ad, setAd] = useState<AdData | null>(adCache[adId] ?? null);
  const [loading, setLoading] = useState(!adCache[adId]);
  const adRef = useRef<AdData | null>(adCache[adId] ?? null);

  useEffect(() => {
    if (!listeners[adId]) listeners[adId] = new Set();

    const handler = (data: AdData) => {
      if (adRef.current && JSON.stringify(adRef.current) === JSON.stringify(data)) return;
      adRef.current = data;
      setAd(data);
    };
    listeners[adId].add(handler);

    if (!adCache[adId]) {
      supabase
        .from('ads')
        .select('*')
        .eq('id', adId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            adCache[adId] = data as AdData;
            adRef.current = data as AdData;
            setAd(data as AdData);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      listeners[adId]?.delete(handler);
    };
  }, [adId]);

  return { ad, loading };
}
