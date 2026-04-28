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
}

// 인메모리 캐시
const adCache: Record<string, AdData> = {};
// 캐시 무효화 리스너
const listeners: Record<string, Set<(data: AdData) => void>> = {};

// AdminAds에서 저장 후 호출해 캐시를 갱신
export function invalidateAdCache(adId: string, updated: AdData) {
  const prev = adCache[adId];
  // 실제로 변경된 경우에만 리스너 호출 (불필요한 리렌더링/깜빡임 방지)
  if (prev && JSON.stringify(prev) === JSON.stringify(updated)) return;
  adCache[adId] = updated;
  listeners[adId]?.forEach(fn => fn(updated));
}

export function useAd(adId: string) {
  const [ad, setAd] = useState<AdData | null>(adCache[adId] ?? null);
  const [loading, setLoading] = useState(!adCache[adId]);
  // 이전 ad 참조를 유지해 불필요한 state 업데이트 방지
  const adRef = useRef<AdData | null>(adCache[adId] ?? null);

  useEffect(() => {
    if (!listeners[adId]) listeners[adId] = new Set();

    const handler = (data: AdData) => {
      // 이전 값과 완전히 동일하면 state 업데이트 생략
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
