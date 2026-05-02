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
 * profiles JOIN으로 followers 값을 함께 가져오고,
 * 최근 1시간 likes 수를 합쳐 HOT 판정에 사용합니다.
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
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, image_url, user_id, user_name, user_avatar, images, content, hot_since, profiles!posts_user_id_fkey(followers, nickname, avatar_url)')

      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const posts = data || [];
    if (posts.length === 0) return [];

    const postIds = posts.map((post: any) => post.id).filter(Boolean);
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentLikes, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .in('post_id', postIds)
      .gte('created_at', oneHourAgoIso);

    if (likesError) throw likesError;

    const likesPerHourMap = new Map<string, number>();
    (recentLikes || []).forEach((like: any) => {
      const postId = String(like.post_id);
      likesPerHourMap.set(postId, (likesPerHourMap.get(postId) ?? 0) + 1);
    });

    return posts.map((post: any) => ({
      ...post,
      likes_per_hour: likesPerHourMap.get(String(post.id)) ?? 0,
    }));
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
 * 코너 포스팅은 lat/lng 초과 비율로 가장 가까운 방향에만 분류합니다.
 * 8방향 쿼리를 병렬로 실행 후 클라이언트에서 합산합니다.
 */
export const fetchOffScreenCounts = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  options?: { categories?: string[]; userId?: string | null }
): Promise<DirectionCounts> => {
  const { sw, ne } = bounds;

  // 카테고리/사용자 필터 적용 헬퍼
  const applyFilters = <T>(q: T): T => {
    let qq: any = q;
    const cats = options?.categories || [];
    if (cats.includes('mine') && options?.userId) {
      qq = qq.eq('user_id', options.userId);
    } else if (!cats.includes('all') && cats.length > 0 && !cats.includes('friends') && !cats.includes('mine')) {
      const dbCats = cats.filter(c => ['food', 'accident', 'place', 'animal'].includes(c));
      if (dbCats.length > 0) {
        qq = qq.in('category', dbCats);
      }
    }
    return qq as T;
  };

  try {
    // 각 방향별로 해당 경계를 벗어난 포스팅 수를 DB에서 직접 카운트
    // 45도 섹터 제한 없이 해당 방향 경계를 벗어난 모든 마커를 카운트
    const [topRes, bottomRes, leftRes, rightRes] = await Promise.all([
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true }).gt('latitude', ne.lat)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true }).lt('latitude', sw.lat)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true }).lt('longitude', sw.lng)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true }).gt('longitude', ne.lng)),
    ]);

    return {
      top: topRes.count ?? 0,
      bottom: bottomRes.count ?? 0,
      left: leftRes.count ?? 0,
      right: rightRes.count ?? 0,
    };
  } catch (err) {
    console.error('[SupabasePosts] Off-screen counts fetch error:', err);
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
};

/**
 * 특정 방향(화면 밖)에서 현재 지도 중심에 가장 가까운 포스팅 좌표를 가져옵니다.
 * nearest가 없을 때 버튼 클릭 시 호출됩니다.
 */
export const fetchNearestInDirection = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  center: { lat: number; lng: number },
  dir: 'top' | 'bottom' | 'left' | 'right',
  options?: { categories?: string[]; userId?: string | null; followingIds?: string[] }
): Promise<{ lat: number; lng: number } | null> => {
  const { sw, ne } = bounds;

  try {
    // DB 쿼리: 해당 방향 경계를 벗어난 것만 정확히 필터링
    // 45도 섹터 제한 없이 해당 방향으로 화면 밖인 모든 마커를 대상으로 함
    let query = supabase.from('posts').select('latitude, longitude');

    if (dir === 'top')    query = query.gt('latitude', ne.lat);
    if (dir === 'bottom') query = query.lt('latitude', sw.lat);
    if (dir === 'left')   query = query.lt('longitude', sw.lng);
    if (dir === 'right')  query = query.gt('longitude', ne.lng);

    // 카테고리/사용자 필터 적용
    const cats = options?.categories || [];
    if (cats.includes('mine') && options?.userId) {
      query = query.eq('user_id', options.userId);
    } else if (cats.includes('friends') && options?.followingIds && options.followingIds.length > 0) {
      query = query.in('user_id', options.followingIds);
    } else if (!cats.includes('all') && cats.length > 0 && !cats.includes('friends') && !cats.includes('mine')) {
      const dbCats = cats.filter(c => ['food', 'accident', 'place', 'animal'].includes(c));
      if (dbCats.length > 0) {
        query = query.in('category', dbCats);
      }
    }

    const { data, error } = await query.limit(500);
    if (error || !data || data.length === 0) return null;

    const valid = data.filter(p => p.latitude != null && p.longitude != null);
    if (valid.length === 0) return null;

    // 현재 지도 중심에서 유클리드 거리가 가장 가까운 포스팅
    let nearest = valid[0];
    let minDist = Infinity;
    for (const p of valid) {
      const d = Math.pow(p.latitude - center.lat, 2) + Math.pow(p.longitude - center.lng, 2);
      if (d < minDist) { minDist = d; nearest = p; }
    }

    return { lat: nearest.latitude, lng: nearest.longitude };
  } catch (err) {
    console.error('[SupabasePosts] fetchNearestInDirection error:', err);
    return null;
  }
};