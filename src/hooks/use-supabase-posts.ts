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

  try {
    const [
      topOnlyRes,
      bottomOnlyRes,
      leftOnlyRes,
      rightOnlyRes,
      cornerRes,  // 코너 포스팅 좌표를 직접 가져와서 클라이언트에서 정확히 분류
    ] = await Promise.all([
      // 순수 상단: lat > qNe.lat AND lng between qSw.lng and qNe.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('latitude', qNe.lat)
        .gte('longitude', qSw.lng).lte('longitude', qNe.lng),
      // 순수 하단: lat < qSw.lat AND lng between qSw.lng and qNe.lng
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('latitude', qSw.lat)
        .gte('longitude', qSw.lng).lte('longitude', qNe.lng),
      // 순수 좌측: lng < qSw.lng AND lat between qSw.lat and qNe.lat
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .lt('longitude', qSw.lng)
        .gte('latitude', qSw.lat).lte('latitude', qNe.lat),
      // 순수 우측: lng > qNe.lng AND lat between qSw.lat and qNe.lat
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .gt('longitude', qNe.lng)
        .gte('latitude', qSw.lat).lte('latitude', qNe.lat),
      // 코너 포스팅: 좌표를 직접 가져와서 클라이언트에서 정확히 분류
      supabase.from('posts').select('latitude, longitude')
        .or(`and(latitude.gt.${qNe.lat},longitude.lt.${qSw.lng}),and(latitude.gt.${qNe.lat},longitude.gt.${qNe.lng}),and(latitude.lt.${qSw.lat},longitude.lt.${qSw.lng}),and(latitude.lt.${qSw.lat},longitude.gt.${qNe.lng})`),
    ]);

    // 코너 포스팅을 각 포스팅의 실제 lat/lng 초과 비율로 정확히 분류
    let topAdd = 0, bottomAdd = 0, leftAdd = 0, rightAdd = 0;
    for (const p of (cornerRes.data ?? [])) {
      if (p.latitude == null || p.longitude == null) continue;
      const isAbove = p.latitude > qNe.lat;
      const isLeft = p.longitude < qSw.lng;
      const isRight = p.longitude > qNe.lng;

      // lat 초과량 / latRange vs lng 초과량 / lngRange
      const latExcess = isAbove
        ? (p.latitude - qNe.lat) / latRange
        : (qSw.lat - p.latitude) / latRange;
      const lngExcess = isLeft
        ? (qSw.lng - p.longitude) / lngRange
        : (p.longitude - qNe.lng) / lngRange;

      if (latExcess >= lngExcess) {
        // lat 방향으로 더 많이 벗어남 → 상/하
        if (isAbove) topAdd++; else bottomAdd++;
      } else {
        // lng 방향으로 더 많이 벗어남 → 좌/우
        if (isLeft) leftAdd++; else rightAdd++;
      }
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