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
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

  // 카카오맵 getBounds()가 실제 화면보다 좁게 반환하는 경우를 보정:
  // 경계를 바깥쪽으로 확장해서 화면 가장자리 포스팅이 "화면 안"으로 판단되도록 함
  // → qNe.lng보다 더 오른쪽에 있어야 right로 카운트
  const pad = 0.10;
  const qSw = { lat: sw.lat - latRange * pad, lng: sw.lng - lngRange * pad };
  const qNe = { lat: ne.lat + latRange * pad, lng: ne.lng + lngRange * pad };

  // 코너 분류 기준: lat 초과 비율 vs lng 초과 비율
  // lat 초과 비율이 더 크면 상/하, lng 초과 비율이 더 크면 좌/우
  // 비율이 같으면 (45도 대각선) 상/하 우선
  // 이를 DB에서 표현하기 위해 각 코너의 분류 경계를 계산
  //
  // 예: 오른쪽 상단 코너에서
  //   lat 초과량 / latRange >= lng 초과량 / lngRange → top
  //   lat 초과량 / latRange <  lng 초과량 / lngRange → right
  //
  // lat 초과량 = lat - ne.lat, lng 초과량 = lng - ne.lng (오른쪽 상단)
  // 경계: (lat - ne.lat) / latRange = (lng - ne.lng) / lngRange
  //      → lat = ne.lat + latRange/lngRange * (lng - ne.lng)
  // 이를 단순화: lat 초과 비율 >= lng 초과 비율이면 top
  //
  // Supabase에서는 computed column이 없으므로,
  // 코너를 "정확히 45도 경계"로 나누는 대신
  // 각 코너를 lat/lng 범위 비율로 분할하는 경계 lat를 계산해서 필터링합니다.

  // 카테고리/사용자 필터 적용 헬퍼
  const applyFilters = <T>(q: T): T => {
    let qq: any = q;
    const cats = options?.categories || [];
    if (cats.includes('mine') && options?.userId) {
      qq = qq.eq('user_id', options.userId);
    } else if (!cats.includes('all') && cats.length > 0 && !cats.includes('friends') && !cats.includes('mine')) {
      // 일반 카테고리 필터: food/accident/place/animal/hot/influencer
      const dbCats = cats.filter(c => ['food', 'accident', 'place', 'animal'].includes(c));
      if (dbCats.length > 0) {
        qq = qq.in('category', dbCats);
      }
    }
    return qq as T;
  };

  try {
    const [
      topOnlyRes,
      bottomOnlyRes,
      leftOnlyRes,
      rightOnlyRes,
      cornerRes,
    ] = await Promise.all([
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('latitude', qNe.lat)
        .gte('longitude', qSw.lng).lte('longitude', qNe.lng)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('latitude', qSw.lat)
        .gte('longitude', qSw.lng).lte('longitude', qNe.lng)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('longitude', qSw.lng)
        .gte('latitude', qSw.lat).lte('latitude', qNe.lat)),
      applyFilters(supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('longitude', qNe.lng)
        .gte('latitude', qSw.lat).lte('latitude', qNe.lat)),
      applyFilters(supabase.from('posts').select('id, latitude, longitude')
        .or(`and(latitude.gt.${qNe.lat},longitude.lt.${qSw.lng}),and(latitude.gt.${qNe.lat},longitude.gt.${qNe.lng}),and(latitude.lt.${qSw.lat},longitude.lt.${qSw.lng}),and(latitude.lt.${qSw.lat},longitude.gt.${qNe.lng})`)),
    ]);

    if (topOnlyRes.error) throw topOnlyRes.error;
    if (bottomOnlyRes.error) throw bottomOnlyRes.error;
    if (leftOnlyRes.error) throw leftOnlyRes.error;
    if (rightOnlyRes.error) throw rightOnlyRes.error;
    if (cornerRes.error) throw cornerRes.error;

    let top = topOnlyRes.count || 0;
    let bottom = bottomOnlyRes.count || 0;
    let left = leftOnlyRes.count || 0;
    let right = rightOnlyRes.count || 0;

    (cornerRes.data || []).forEach((p: any) => {
      const latExcessTop = p.latitude > qNe.lat ? (p.latitude - qNe.lat) / latRange : 0;
      const latExcessBottom = p.latitude < qSw.lat ? (qSw.lat - p.latitude) / latRange : 0;
      const lngExcessLeft = p.longitude < qSw.lng ? (qSw.lng - p.longitude) / lngRange : 0;
      const lngExcessRight = p.longitude > qNe.lng ? (p.longitude - qNe.lng) / lngRange : 0;

      const vertical = Math.max(latExcessTop, latExcessBottom);
      const horizontal = Math.max(lngExcessLeft, lngExcessRight);

      if (vertical >= horizontal) {
        if (latExcessTop > 0) top++;
        else bottom++;
      } else {
        if (lngExcessLeft > 0) left++;
        else right++;
      }
    });

    return { top, bottom, left, right };
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
  dir: 'top' | 'bottom' | 'left' | 'right'
): Promise<{ lat: number; lng: number } | null> => {
  const { sw, ne } = bounds;

  try {
    let query = supabase
      .from('posts')
      .select('latitude, longitude');

    // 코너 포스팅도 포함하기 위해 lng/lat 범위 제한 없이 방향만으로 필터링
    // 단, 코너 포스팅은 fetchOffScreenCounts와 동일한 비율 분류 기준으로 필터링
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

    if (dir === 'top') {
      // lat > ne.lat인 포스팅 중 lat 초과 비율 >= lng 초과 비율인 것
      // (순수 상단 + 상단 코너 중 lat 방향이 더 큰 것)
      query = query.gt('latitude', ne.lat);
    } else if (dir === 'bottom') {
      query = query.lt('latitude', sw.lat);
    } else if (dir === 'left') {
      query = query.lt('longitude', sw.lng);
    } else {
      query = query.gt('longitude', ne.lng);
    }

    const { data, error } = await query.limit(200);
    if (error || !data || data.length === 0) return null;

    // fetchOffScreenCounts와 동일한 비율 분류로 해당 방향에 속하는 포스팅만 필터링
    const filtered = data.filter(p => {
      if (p.latitude == null || p.longitude == null) return false;
      const inLat = p.latitude >= sw.lat && p.latitude <= ne.lat;
      const inLng = p.longitude >= sw.lng && p.longitude <= ne.lng;
      if (inLat && inLng) return false; // 화면 안

      const isAbove = p.latitude > ne.lat;
      const isBelow = p.latitude < sw.lat;
      const isLeft  = p.longitude < sw.lng;
      const isRight = p.longitude > ne.lng;

      // 순수 방향
      if (dir === 'top'    && isAbove && !isLeft && !isRight) return true;
      if (dir === 'bottom' && isBelow && !isLeft && !isRight) return true;
      if (dir === 'left'   && isLeft  && !isAbove && !isBelow) return true;
      if (dir === 'right'  && isRight && !isAbove && !isBelow) return true;

      // 코너: 비율로 분류
      const latExcess = isAbove ? (p.latitude - ne.lat) / latRange : isBelow ? (sw.lat - p.latitude) / latRange : 0;
      const lngExcess = isLeft  ? (sw.lng - p.longitude) / lngRange : isRight ? (p.longitude - ne.lng) / lngRange : 0;

      if (latExcess >= lngExcess) {
        return (dir === 'top' && isAbove) || (dir === 'bottom' && isBelow);
      } else {
        return (dir === 'left' && isLeft) || (dir === 'right' && isRight);
      }
    });

    if (filtered.length === 0) return null;

    // 중심에서 가장 가까운 포스팅 찾기
    let nearest = filtered[0];
    let minDist = Infinity;
    for (const p of filtered) {
      const d = Math.sqrt(
        Math.pow(p.latitude - center.lat, 2) + Math.pow(p.longitude - center.lng, 2)
      );
      if (d < minDist) { minDist = d; nearest = p; }
    }

    return nearest?.latitude != null
      ? { lat: nearest.latitude, lng: nearest.longitude }
      : null;
  } catch (err) {
    console.error('[SupabasePosts] fetchNearestInDirection error:', err);
    return null;
  }
};