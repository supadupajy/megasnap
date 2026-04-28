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
  // 현재 광고 기간 (ISO 8601 datetime string, timestamptz)
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

export interface AdSlot {
  image_url: string;
  title: string;
  subtitle: string;
  link_url: string;
  brand_name: string;
  brand_logo_url: string;
  isNext: boolean; // 다음 광고가 현재로 승격된 경우 true
}

/**
 * 현재 시각 기준으로 유효한 광고 슬롯을 반환.
 *
 * 판단 로직:
 * 1. 현재 광고에 end_date가 있고 이미 지났으면 → "만료"
 * 2. 만료됐고 next_image_url이 있고 next_start_date가 현재 이전이면 → 다음 광고 승격
 * 3. 그 외 → 현재 광고 반환
 *
 * start_date / end_date 는 timestamptz (ISO 8601) 문자열.
 */
export function resolveActiveSlot(ad: AdData, now: Date = new Date()): AdSlot {
  const currentExpired =
    ad.end_date != null && new Date(ad.end_date) <= now;

  const nextAvailable =
    !!ad.next_image_url &&
    (ad.next_start_date == null || new Date(ad.next_start_date) <= now);

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

/**
 * 다음 전환이 일어날 때까지 남은 ms를 계산.
 * - 현재 광고 end_date가 미래면 그 시각까지
 * - 다음 광고 next_start_date가 미래면 그 시각까지
 * - 없으면 null (타이머 불필요)
 */
function msUntilNextTransition(ad: AdData, now: Date): number | null {
  const candidates: number[] = [];

  if (ad.end_date) {
    const t = new Date(ad.end_date).getTime() - now.getTime();
    if (t > 0) candidates.push(t);
  }
  if (ad.next_start_date) {
    const t = new Date(ad.next_start_date).getTime() - now.getTime();
    if (t > 0) candidates.push(t);
  }
  if (ad.next_end_date) {
    const t = new Date(ad.next_end_date).getTime() - now.getTime();
    if (t > 0) candidates.push(t);
  }

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

// ─── 인메모리 캐시 & 리스너 ───────────────────────────────────────────────────
const adCache: Record<string, AdData> = {};
const listeners: Record<string, Set<(data: AdData) => void>> = {};

export function invalidateAdCache(adId: string, updated: AdData) {
  const prev = adCache[adId];
  if (prev && JSON.stringify(prev) === JSON.stringify(updated)) return;
  adCache[adId] = updated;
  listeners[adId]?.forEach(fn => fn(updated));
}

// ─── useAd ────────────────────────────────────────────────────────────────────
export function useAd(adId: string) {
  const [ad, setAd] = useState<AdData | null>(adCache[adId] ?? null);
  const [loading, setLoading] = useState(!adCache[adId]);
  // 현재 시각을 state로 관리 → 전환 시점에 리렌더 트리거
  const [now, setNow] = useState(() => new Date());
  const adRef = useRef<AdData | null>(adCache[adId] ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 전환 타이머 설정 함수
  const scheduleTransition = (currentAd: AdData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = msUntilNextTransition(currentAd, new Date());
    if (ms == null) return;

    // 전환 시각 + 100ms 여유를 두고 now를 갱신 → resolveActiveSlot 재계산
    timerRef.current = setTimeout(() => {
      setNow(new Date());
      // 전환 후 다음 전환도 예약
      if (adRef.current) scheduleTransition(adRef.current);
    }, ms + 100);
  };

  useEffect(() => {
    if (!listeners[adId]) listeners[adId] = new Set();

    const handler = (data: AdData) => {
      if (adRef.current && JSON.stringify(adRef.current) === JSON.stringify(data)) return;
      adRef.current = data;
      setAd(data);
      setNow(new Date()); // 새 데이터 기준으로 슬롯 즉시 재계산
      scheduleTransition(data);
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
            scheduleTransition(data as AdData);
          }
          setLoading(false);
        });
    } else {
      scheduleTransition(adCache[adId]);
      setLoading(false);
    }

    return () => {
      listeners[adId]?.delete(handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [adId]);

  // ad와 now를 함께 반환 → 컴포넌트에서 resolveActiveSlot(ad, now) 호출
  return { ad, loading, now };
}
