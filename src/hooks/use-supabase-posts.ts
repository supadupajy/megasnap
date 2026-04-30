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
 * 코너 포스팅은 lat/lng 초과 비율로 가장 가까운 방향에만 분류합니다.
 * 8방향 쿼리를 병렬로 실행 후 클라이언트에서 합산합니다.
 */
export const fetchOffScreenCounts = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }
): Promise<DirectionCounts> => {
  const { sw, ne } = bounds;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

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

  try {
    const [
      topOnlyRes,      // 위: lat > ne.lat AND lng between sw.lng and ne.lng (순수 상단)
      bottomOnlyRes,   // 아래: lat < sw.lat AND lng between sw.lng and ne.lng (순수 하단)
      leftOnlyRes,     // 왼쪽: lng < sw.lng AND lat between sw.lat and ne.lat (순수 좌측)
      rightOnlyRes,    // 오른쪽: lng > ne.lng AND lat between sw.lat and ne.lat (순수 우측)
      topLeftRes,      // 왼쪽 상단 코너
      topRightRes,     // 오른쪽 상단 코너
      bottomLeftRes,   // 왼쪽 하단 코너
      bottomRightRes,  // 오른쪽 하단 코너
    ] = await Promise.all([
      // 순수 상단 (코너 제외)
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('latitude', ne.lat)
        .gte('longitude', sw.lng).lte('longitude', ne.lng),
      // 순수 하단 (코너 제외)
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('latitude', sw.lat)
        .gte('longitude', sw.lng).lte('longitude', ne.lng),
      // 순수 좌측 (코너 제외)
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('longitude', sw.lng)
        .gte('latitude', sw.lat).lte('latitude', ne.lat),
      // 순수 우측 (코너 제외)
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('longitude', ne.lng)
        .gte('latitude', sw.lat).lte('latitude', ne.lat),
      // 왼쪽 상단 코너: lat > ne.lat AND lng < sw.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('latitude', ne.lat).lt('longitude', sw.lng),
      // 오른쪽 상단 코너: lat > ne.lat AND lng > ne.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('latitude', ne.lat).gt('longitude', ne.lng),
      // 왼쪽 하단 코너: lat < sw.lat AND lng < sw.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('latitude', sw.lat).lt('longitude', sw.lng),
      // 오른쪽 하단 코너: lat < sw.lat AND lng > ne.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('latitude', sw.lat).gt('longitude', ne.lng),
    ]);

    // 코너 포스팅을 lat/lng 초과 비율로 분류
    // lat 초과 비율 >= lng 초과 비율 → 상/하 방향으로 분류
    // lat 초과 비율 <  lng 초과 비율 → 좌/우 방향으로 분류
    //
    // 단, DB에서 개별 포스팅 좌표를 모르므로 코너 전체를 하나의 방향으로 분류합니다.
    // 코너의 "대표 비율"은 코너 영역의 중심점 기준으로 계산합니다.
    // 왼쪽 상단: lat 초과 비율 vs lng 초과 비율 → latRange/lngRange 비교
    // latRange >= lngRange이면 lat 방향이 더 길므로 코너는 좌/우로 분류
    // latRange < lngRange이면 lng 방향이 더 길므로 코너는 상/하로 분류
    const topLeftCount = topLeftRes.count ?? 0;
    const topRightCount = topRightRes.count ?? 0;
    const bottomLeftCount = bottomLeftRes.count ?? 0;
    const bottomRightCount = bottomRightRes.count ?? 0;

    // 화면 비율: latRange/lngRange > 1이면 세로가 더 긴 화면 → 코너는 좌우로
    //           latRange/lngRange < 1이면 가로가 더 긴 화면 → 코너는 상하로
    // 즉, lat 초과 비율 >= lng 초과 비율이면 상하 방향
    // 코너 중심의 lat 초과 = 코너 영역 중심 lat - ne.lat (또는 sw.lat - 코너 중심 lat)
    // 코너 중심의 lng 초과 = 코너 영역 중심 lng - ne.lng (또는 sw.lng - 코너 중심 lng)
    // 코너 영역은 무한히 넓으므로 "경계선"으로 판단:
    // 경계: latExcess/latRange = lngExcess/lngRange
    // 코너 포스팅이 이 경계보다 lat 방향으로 더 벗어나면 상/하, lng 방향이면 좌/우
    // 단순화: 화면의 가로세로 비율로 코너 전체를 한 방향으로 분류
    // latRange >= lngRange → 세로가 더 길거나 같음 → 코너는 좌/우로 분류
    // latRange < lngRange  → 가로가 더 길음 → 코너는 상/하로 분류
    let topAdd = 0, bottomAdd = 0, leftAdd = 0, rightAdd = 0;

    if (latRange >= lngRange) {
      // 세로가 더 길거나 같음: 코너는 좌/우로 분류
      leftAdd = topLeftCount + bottomLeftCount;
      rightAdd = topRightCount + bottomRightCount;
    } else {
      // 가로가 더 길음: 코너는 상/하로 분류
      topAdd = topLeftCount + topRightCount;
      bottomAdd = bottomLeftCount + bottomRightCount;
    }

    return {
      top: (topOnlyRes.count ?? 0) + topAdd,
      bottom: (bottomOnlyRes.count ?? 0) + bottomAdd,
      left: (leftOnlyRes.count ?? 0) + leftAdd,
      right: (rightOnlyRes.count ?? 0) + rightAdd,
    };
  } catch (err) {
    console.error('[SupabasePosts] fetchOffScreenCounts error:', err);
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

    if (dir === 'top') {
      query = query.gt('latitude', ne.lat).gte('longitude', sw.lng).lte('longitude', ne.lng);
    } else if (dir === 'bottom') {
      query = query.lt('latitude', sw.lat).gte('longitude', sw.lng).lte('longitude', ne.lng);
    } else if (dir === 'left') {
      query = query.lt('longitude', sw.lng).gte('latitude', sw.lat).lte('latitude', ne.lat);
    } else {
      query = query.gt('longitude', ne.lng).gte('latitude', sw.lat).lte('latitude', ne.lat);
    }

    const { data, error } = await query.limit(100);
    if (error || !data || data.length === 0) return null;

    // 중심에서 가장 가까운 포스팅 찾기
    let nearest = data[0];
    let minDist = Infinity;
    for (const p of data) {
      if (p.latitude == null || p.longitude == null) continue;
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