import { useState, useEffect } from 'react';
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
}

// 인메모리 캐시
const adCache: Record<string, AdData> = {};
// 캐시 무효화 리스너
const listeners: Record<string, Set<(data: AdData) => void>> = {};

// AdminAds에서 저장 후 호출해 캐시를 갱신
export function invalidateAdCache(adId: string, updated: AdData) {
  adCache[adId] = updated;
  listeners[adId]?.forEach(fn => fn(updated));
}

export function useAd(adId: string) {
  const [ad, setAd] = useState<AdData | null>(adCache[adId] ?? null);
  const [loading, setLoading] = useState(!adCache[adId]);

  useEffect(() => {
    // 리스너 등록 (다른 탭/컴포넌트에서 캐시 갱신 시 반영)
    if (!listeners[adId]) listeners[adId] = new Set();
    const handler = (data: AdData) => setAd(data);
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
