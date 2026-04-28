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

// 간단한 인메모리 캐시 (페이지 새로고침 전까지 유지)
const adCache: Record<string, AdData> = {};

export function useAd(adId: string) {
  const [ad, setAd] = useState<AdData | null>(adCache[adId] ?? null);
  const [loading, setLoading] = useState(!adCache[adId]);

  useEffect(() => {
    if (adCache[adId]) {
      setAd(adCache[adId]);
      setLoading(false);
      return;
    }

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
  }, [adId]);

  return { ad, loading };
}
