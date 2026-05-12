import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { pushDebugLog } from '@/components/DebugBannerOverlay';

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
  isRecruitment: boolean; // 만료 후 구인 광고 슬롯인 경우 true
  isPending: boolean; // 시작 시간 전 대기 중인 경우 true
}

// https:// 없는 URL에 자동으로 프로토콜 추가
export function normalizeUrl(url: string): string {
  if (!url) return url;
  if (/^mailto:/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// 광고 만료 시 보여줄 구인 슬롯
export const RECRUITMENT_SLOT: AdSlot = {
  image_url: '/assets/ad-recruitment-banner.png',
  title: '광고 문의',
  subtitle: 'chorasnap@gmail.com',
  link_url: 'mailto:chorasnap@gmail.com',
  brand_name: 'ChoraSnap',
  brand_logo_url: '',
  isNext: false,
  isRecruitment: true,
  isPending: false,
};

// 시작 전 대기 중 슬롯 (마커는 보이되 반투명 처리)
export const PENDING_SLOT: AdSlot = {
  image_url: '',
  title: '광고 준비 중',
  subtitle: '',
  link_url: '',
  brand_name: '',
  brand_logo_url: '',
  isNext: false,
  isRecruitment: false,
  isPending: true,
};

/**
 * 현재 시각 기준으로 유효한 광고 슬롯을 반환.
 *
 * 판단 로직:
 * 1. start_date가 있고 아직 안 됐으면 → 미표시 (image_url = '')
 * 2. end_date가 있고 이미 지났으면 → "만료"
 *    - next_image_url이 있고 next_start_date가 현재 이전이면 → 다음 광고 승격
 *    - 없으면 → 빈 슬롯 (image_url = '')
 * 3. 그 외 → 현재 광고 반환
 */
export function resolveActiveSlot(ad: AdData, now: Date = new Date()): AdSlot {
  const currentStarted =
    ad.start_date == null || new Date(ad.start_date) <= now;

  const currentExpired =
    ad.end_date != null && new Date(ad.end_date) <= now;

  // 아직 시작 전이면 → 반투명 대기 마커 (RECRUITMENT_SLOT 대신 PENDING_SLOT)
  if (!currentStarted) {
    return PENDING_SLOT;
  }

  // next 광고가 있고, 이미 시작됐는지 확인
  const nextStarted =
    !!ad.next_image_url &&
    (ad.next_start_date == null || new Date(ad.next_start_date) <= now);

  // next 광고가 만료됐는지 확인
  const nextExpired =
    ad.next_end_date != null && new Date(ad.next_end_date) <= now;

  // 현재 광고가 만료된 경우
  if (currentExpired) {
    // next 광고가 있고, 시작됐고, 아직 만료 안 됐으면 → next 광고 표시
    if (nextStarted && !nextExpired) {
      return {
        image_url: ad.next_image_url!,
        title: ad.next_title || '',
        subtitle: ad.next_subtitle || '',
        link_url: ad.next_link_url || '',
        brand_name: ad.next_brand_name || '',
        brand_logo_url: ad.next_brand_logo_url || '',
        isNext: true,
        isRecruitment: false,
        isPending: false,
      };
    }
    // next도 없거나 만료됐으면 → 구인 슬롯
    return RECRUITMENT_SLOT;
  }

  // 현재 광고 기간이 없는 경우(end_date = null): next 광고가 있으면 next 상태 확인
  if (ad.end_date == null && ad.next_image_url) {
    // next가 시작됐고 아직 만료 안 됐으면 → next 광고 표시
    if (nextStarted && !nextExpired) {
      return {
        image_url: ad.next_image_url!,
        title: ad.next_title || '',
        subtitle: ad.next_subtitle || '',
        link_url: ad.next_link_url || '',
        brand_name: ad.next_brand_name || '',
        brand_logo_url: ad.next_brand_logo_url || '',
        isNext: true,
        isRecruitment: false,
        isPending: false,
      };
    }
    // next가 만료됐으면 → 구인 슬롯
    if (nextExpired) {
      return RECRUITMENT_SLOT;
    }
    // next가 아직 시작 전이면 → 현재 광고 표시 (예약 대기 중)
  }

  // 현재 광고가 유효한 경우
  // image_url이 없으면 구인 슬롯
  if (!ad.image_url) {
    return RECRUITMENT_SLOT;
  }

  return {
    image_url: ad.image_url,
    title: ad.title,
    subtitle: ad.subtitle,
    link_url: ad.link_url,
    brand_name: ad.brand_name,
    brand_logo_url: ad.brand_logo_url,
    isNext: false,
    isRecruitment: false,
    isPending: false,
  };
}

/**
 * 다음 전환이 일어날 때까지 남은 ms를 계산.
 * - 현재 광고 start_date가 미래면 그 시각까지 (시작 대기)
 * - 현재 광고 end_date가 미래면 그 시각까지
 * - 다음 광고 next_start_date가 미래면 그 시각까지
 * - 없으면 null (타이머 불필요)
 */
function msUntilNextTransition(ad: AdData, now: Date): number | null {
  const candidates: number[] = [];

  if (ad.start_date) {
    const t = new Date(ad.start_date).getTime() - now.getTime();
    if (t > 0) candidates.push(t);
  }
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

  // stale closure 방지: 함수 자체를 ref로 관리
  const scheduleTransitionRef = useRef<(currentAd: AdData) => void>(() => {});

  scheduleTransitionRef.current = (currentAd: AdData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = msUntilNextTransition(currentAd, new Date());
    if (ms == null) {
      pushDebugLog(`[useAd:${adId}] scheduleTransition: no next transition`);
      return;
    }
    pushDebugLog(`[useAd:${adId}] scheduleTransition in ${ms}ms`);

    // 전환 시각 + 100ms 여유를 두고 now를 갱신 → resolveActiveSlot 재계산
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pushDebugLog(`[useAd:${adId}] ⏲️ timer fired → setNow`);
      setNow(new Date());
      // ref를 통해 항상 최신 함수 + 최신 ad 참조 (stale closure 완전 방지)
      if (adRef.current) scheduleTransitionRef.current(adRef.current);
    }, ms + 100);
  };

  useEffect(() => {
    pushDebugLog(`[useAd:${adId}] ▶️ useEffect run (cached=${!!adCache[adId]})`);
    if (!listeners[adId]) listeners[adId] = new Set();

    const handler = (data: AdData) => {
      if (adRef.current && JSON.stringify(adRef.current) === JSON.stringify(data)) {
        pushDebugLog(`[useAd:${adId}] handler: identical, skip`);
        return;
      }
      pushDebugLog(`[useAd:${adId}] handler: NEW data → setAd + setNow`);
      adRef.current = data;
      setAd(data);
      setNow(new Date());
      scheduleTransitionRef.current(data);
    };
    listeners[adId].add(handler);
    pushDebugLog(`[useAd:${adId}] listeners=${listeners[adId].size}`);

    if (!adCache[adId]) {
      pushDebugLog(`[useAd:${adId}] fetching from supabase…`);
      supabase
        .from('ads')
        .select('*')
        .eq('id', adId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            pushDebugLog(`[useAd:${adId}] fetched OK → setAd`);
            adCache[adId] = data as AdData;
            adRef.current = data as AdData;
            setAd(data as AdData);
            scheduleTransitionRef.current(data as AdData);
          } else {
            pushDebugLog(`[useAd:${adId}] fetch error=${error?.message || 'none'} data=${!!data}`);
          }
          setLoading(false);
        });
    } else {
      pushDebugLog(`[useAd:${adId}] using cache`);
      scheduleTransitionRef.current(adCache[adId]);
      setLoading(false);
    }

    // ── Supabase Realtime 구독: 기존 채널 제거 후 새로 생성 ──
    // React Strict Mode에서 useEffect가 두 번 실행될 때 채널 중복 생성 방지
    const channelName = `ads-realtime-${adId}`;
    const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      pushDebugLog(`[useAd:${adId}] ⚠️ removing existing channel`);
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ads', filter: `id=eq.${adId}` },
        (payload) => {
          pushDebugLog(`[useAd:${adId}] 📡 realtime UPDATE received`);
          const updated = payload.new as AdData;
          adCache[adId] = updated;
          listeners[adId]?.forEach(fn => fn(updated));
        }
      )
      .subscribe((status) => {
        pushDebugLog(`[useAd:${adId}] 📡 channel status=${status}`);
      });

    return () => {
      pushDebugLog(`[useAd:${adId}] 🧹 cleanup useEffect`);
      listeners[adId]?.delete(handler);
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [adId]);

  // ad와 now를 함께 반환 → 컴포넌트에서 resolveActiveSlot(ad, now) 호출
  return { ad, loading, now };
}

// ─── useMapMarkerAds: ad_type='map_marker'인 모든 광고 구독 ──────────────────
export function useMapMarkerAds() {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const adsRef = useRef<AdData[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // stale closure 방지: 함수 자체를 ref로 관리
  const scheduleNextTransitionRef = useRef<(adList: AdData[]) => void>(() => {});

  scheduleNextTransitionRef.current = (adList: AdData[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const currentNow = new Date();
    const candidates: number[] = [];
    adList.forEach(ad => {
      if (ad.start_date) {
        const t = new Date(ad.start_date).getTime() - currentNow.getTime();
        if (t > 0) candidates.push(t);
      }
      if (ad.end_date) {
        const t = new Date(ad.end_date).getTime() - currentNow.getTime();
        if (t > 0) candidates.push(t);
      }
      if (ad.next_start_date) {
        const t = new Date(ad.next_start_date).getTime() - currentNow.getTime();
        if (t > 0) candidates.push(t);
      }
      if (ad.next_end_date) {
        const t = new Date(ad.next_end_date).getTime() - currentNow.getTime();
        if (t > 0) candidates.push(t);
      }
    });
    if (candidates.length === 0) return;
    const ms = Math.min(...candidates);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setNow(new Date());
      // ref를 통해 항상 최신 함수 + 최신 adList 참조 (stale closure 완전 방지)
      if (adsRef.current.length > 0) {
        scheduleNextTransitionRef.current(adsRef.current);
      }
    }, ms + 100);
  };

  useEffect(() => {
    const fetchAds = async () => {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('ad_type', 'map_marker');
      if (!error && data) {
        const adList = data as AdData[];
        adsRef.current = adList;
        setAds(adList);
        scheduleNextTransitionRef.current(adList);
      }
      setLoading(false);
    };
    fetchAds();

    // Realtime 구독: map_marker 타입 광고 변경 감지
    const channelName = 'map-marker-ads-realtime';
    const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) supabase.removeChannel(existingChannel);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ads' },
        async () => {
          // 변경 시 전체 재조회 (INSERT/UPDATE/DELETE 모두 처리)
          const { data, error } = await supabase
            .from('ads')
            .select('*')
            .eq('ad_type', 'map_marker');
          if (!error && data) {
            const adList = data as AdData[];
            adsRef.current = adList;
            setAds(adList);
            setNow(new Date());
            scheduleNextTransitionRef.current(adList);
          }
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  return { ads, loading, now };
}