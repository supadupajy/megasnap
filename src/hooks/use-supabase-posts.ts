"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * follower 수 기반으로 인플루언서 등급 결정
 * - Diamond: 1,000만 이상
 * - Gold: 100만 이상
 * - Silver: 10만 이상
 * - None: 그 외
 */
export const getTierFromFollowers = (followers: number): string => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

/**
 * Fetches posts within the given geographical bounds with a limit.
 * profiles JOIN으로 followers 값을 함께 가져와 tier 결정에 사용.
 */
export const fetchPostsInBounds = async (
  sw: { lat: number, lng: number }, 
  ne: { lat: number, lng: number },
  currentLevel: number = 6,
  center?: { lat: number; lng: number }
) => {
  let limit = 150;
  if (currentLevel >= 7) limit = 200;
  if (currentLevel >= 9) limit = 250;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, youtube_url, image_url, user_id, display_user_id, user_name, user_avatar, is_seed_data, images, content, hot_since, profiles!posts_user_id_fkey(followers, nickname, avatar_url)')
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

export interface DirectionCounts {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * 현재 화면 bounds 밖의 포스트 수를 방향별로 COUNT 쿼리로 가져옵니다.
 * 데이터는 가져오지 않고 숫자만 가져오므로 매우 가볍습니다.
 */
export const fetchOffScreenCounts = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }
): Promise<DirectionCounts> => {
  const { sw, ne } = bounds;

  try {
    // 4방향 COUNT 쿼리를 병렬로 실행
    const [topRes, bottomRes, leftRes, rightRes] = await Promise.all([
      // 위: lat > ne.lat
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gt('latitude', ne.lat),
      // 아래: lat < sw.lat
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .lt('latitude', sw.lat),
      // 왼쪽: lng < sw.lng AND lat between sw.lat and ne.lat
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .lt('longitude', sw.lng)
        .gte('latitude', sw.lat)
        .lte('latitude', ne.lat),
      // 오른쪽: lng > ne.lng AND lat between sw.lat and ne.lat
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gt('longitude', ne.lng)
        .gte('latitude', sw.lat)
        .lte('latitude', ne.lat),
    ]);

    return {
      top: topRes.count ?? 0,
      bottom: bottomRes.count ?? 0,
      left: leftRes.count ?? 0,
      right: rightRes.count ?? 0,
    };
  } catch (err) {
    console.error('[SupabasePosts] fetchOffScreenCounts error:', err);
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
};