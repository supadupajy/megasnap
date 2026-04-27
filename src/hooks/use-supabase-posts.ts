"use client";

import { supabase } from "@/integrations/supabase/client";

export const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

/**
 * Fetches posts within the given geographical bounds with a limit.
 * [Optimized] 마커 표시에 필요한 최소 컬럼만 select.
 * - content/profiles JOIN/user_name/user_avatar/is_seed_data/borderType 제거
 * - 마커 클릭 시점에 handleMarkerClick에서 전체 데이터를 다시 fetch하므로 안전
 * - borderType은 클라이언트에서 id 해시로 계산되므로 DB 컬럼 불필요
 */
export const fetchPostsInBounds = async (
  sw: { lat: number, lng: number }, 
  ne: { lat: number, lng: number },
  currentLevel: number = 6,
  center?: { lat: number; lng: number }
) => {
  // 줌 레벨에 따라 limit 조정 (egress 절감을 위해 축소)
  // 줌 7 이상에서는 Index.tsx에서 마커를 어차피 숨기므로 더 적게 가져와도 무방
  let limit = 150;
  if (currentLevel >= 7) limit = 200;
  if (currentLevel >= 9) limit = 250;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, youtube_url, image_url, user_id, images')
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[SupabasePosts] Fetch error:', err);
    return [];
  }
};
