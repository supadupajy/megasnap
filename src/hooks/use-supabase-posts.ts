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

export interface MarkerCluster {
  count: number;
  avgLat: number;
  avgLng: number;
}

export interface DirectionCounts {
  clusters: MarkerCluster[];
  // 하위 호환 (fetchNearestInDirection용 — 방향 클릭 시 사용)
  top: number;
  bottom: number;
  left: number;
  right: number;
  hasTop: boolean;
  hasBottom: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  topAvgLat?: number;
  topAvgLng?: number;
  bottomAvgLat?: number;
  bottomAvgLng?: number;
  leftAvgLat?: number;
  leftAvgLng?: number;
  rightAvgLat?: number;
  rightAvgLng?: number;
}

/** 각도 기반 클러스터링: 비슷한 방향의 마커를 하나로 묶음 */
function clusterByAngle(
  points: { lat: number; lng: number }[],
  centerLat: number,
  centerLng: number,
  latRange: number,
  lngRange: number,
  angleThresholdDeg = 45
): MarkerCluster[] {
  if (points.length === 0) return [];

  // 각 포인트의 각도 계산 (화면 중심 기준, 위쪽=0, 시계방향)
  const withAngle = points.map(p => {
    const dx = (p.lng - centerLng) / lngRange;
    const dy = -(p.lat - centerLat) / latRange; // 화면 Y는 위가 음수
    const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 위쪽=0 기준
    return { ...p, angleDeg: (angleDeg + 360) % 360 };
  });

  // 각도 기준 정렬
  withAngle.sort((a, b) => a.angleDeg - b.angleDeg);

  const clusters: MarkerCluster[] = [];
  const used = new Array(withAngle.length).fill(false);

  for (let i = 0; i < withAngle.length; i++) {
    if (used[i]) continue;
    const group = [withAngle[i]];
    used[i] = true;

    for (let j = i + 1; j < withAngle.length; j++) {
      if (used[j]) continue;
      // 각도 차이 (원형 거리)
      let diff = Math.abs(withAngle[j].angleDeg - withAngle[i].angleDeg);
      if (diff > 180) diff = 360 - diff;
      if (diff <= angleThresholdDeg) {
        group.push(withAngle[j]);
        used[j] = true;
      }
    }

    const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const avgLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
    clusters.push({ count: group.length, avgLat, avgLng });
  }

  return clusters;
}

/**
 * 현재 화면 bounds 밖의 포스트 수를 방향별로 COUNT 쿼리로 가져옵니다.
 * - count: 각 마커는 가장 주된 방향 1개에만 카운트 (중복 없음)
 * - has*: 해당 방향으로 실제로 벗어난 마커가 하나라도 있으면 true (뱃지 표시 여부)
 */
export const fetchOffScreenCounts = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  options?: { categories?: string[]; userId?: string | null }
): Promise<DirectionCounts> => {
  const { sw, ne } = bounds;
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

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
    const res = await applyFilters(
      supabase.from('posts').select('latitude, longitude')
        .or(`latitude.gt.${ne.lat},latitude.lt.${sw.lat},longitude.lt.${sw.lng},longitude.gt.${ne.lng}`)
    );

    if (res.error) throw res.error;

    let top = 0, bottom = 0, left = 0, right = 0;
    let hasTop = false, hasBottom = false, hasLeft = false, hasRight = false;

    // 평균 좌표 계산용 누적값 (lat/lng 모두)
    let topSumLat = 0, topSumLng = 0;
    let bottomSumLat = 0, bottomSumLng = 0;
    let leftSumLat = 0, leftSumLng = 0;
    let rightSumLat = 0, rightSumLng = 0;

    const offScreenPoints: { lat: number; lng: number }[] = [];

    (res.data || []).forEach((p: any) => {
      if (p.latitude == null || p.longitude == null) return;
      // 화면 안이면 제외
      if (p.latitude >= sw.lat && p.latitude <= ne.lat && p.longitude >= sw.lng && p.longitude <= ne.lng) return;

      offScreenPoints.push({ lat: p.latitude, lng: p.longitude });

      // 실제로 벗어난 방향 판별 (has* 용 — 중복 허용)
      const outTop    = p.latitude > ne.lat;
      const outBottom = p.latitude < sw.lat;
      const outLeft   = p.longitude < sw.lng;
      const outRight  = p.longitude > ne.lng;

      if (outTop)    hasTop    = true;
      if (outBottom) hasBottom = true;
      if (outLeft)   hasLeft   = true;
      if (outRight)  hasRight  = true;

      // 가장 주된 방향 1개에만 카운트 (45도 섹터 독점 분류)
      const dLat = (p.latitude - centerLat) / latRange;
      const dLng = (p.longitude - centerLng) / lngRange;
      if      (dLat >= 0 && dLat >= Math.abs(dLng))           { top++;    topSumLat    += p.latitude;  topSumLng    += p.longitude; }
      else if (dLat < 0  && Math.abs(dLat) > Math.abs(dLng))  { bottom++; bottomSumLat += p.latitude;  bottomSumLng += p.longitude; }
      else if (dLng < 0  && Math.abs(dLng) >= Math.abs(dLat)) { left++;   leftSumLat   += p.latitude;  leftSumLng   += p.longitude; }
      else                                                      { right++;  rightSumLat  += p.latitude;  rightSumLng  += p.longitude; }
    });

    const clusters = clusterByAngle(offScreenPoints, centerLat, centerLng, latRange, lngRange);

    return {
      clusters,
      top, bottom, left, right,
      hasTop, hasBottom, hasLeft, hasRight,
      topAvgLat:    top    > 0 ? topSumLat    / top    : centerLat,
      topAvgLng:    top    > 0 ? topSumLng    / top    : centerLng,
      bottomAvgLat: bottom > 0 ? bottomSumLat / bottom : centerLat,
      bottomAvgLng: bottom > 0 ? bottomSumLng / bottom : centerLng,
      leftAvgLat:   left   > 0 ? leftSumLat   / left   : centerLat,
      leftAvgLng:   left   > 0 ? leftSumLng   / left   : centerLng,
      rightAvgLat:  right  > 0 ? rightSumLat  / right  : centerLat,
      rightAvgLng:  right  > 0 ? rightSumLng  / right  : centerLng,
    };
  } catch (err) {
    console.error('[SupabasePosts] Off-screen counts fetch error:', err);
    return { clusters: [], top: 0, bottom: 0, left: 0, right: 0, hasTop: false, hasBottom: false, hasLeft: false, hasRight: false };
  }
};

/**
 * 특정 방향(화면 밖)에서 현재 지도 중심에 가장 가까운 포스팅 좌표를 가져옵니다.
 */
export const fetchNearestInDirection = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  center: { lat: number; lng: number },
  dir: 'top' | 'bottom' | 'left' | 'right',
  options?: { categories?: string[]; userId?: string | null; followingIds?: string[] }
): Promise<{ lat: number; lng: number } | null> => {
  const { sw, ne } = bounds;
  const centerLat = (sw.lat + ne.lat) / 2;
  const centerLng = (sw.lng + ne.lng) / 2;
  const latRange = ne.lat - sw.lat;
  const lngRange = ne.lng - sw.lng;

  try {
    // 화면 밖 전체 포스팅을 가져와서 클라이언트에서 45도 섹터 독점 분류 후 가장 가까운 것 선택
    let query = supabase.from('posts').select('latitude, longitude')
      .or(`latitude.gt.${ne.lat},latitude.lt.${sw.lat},longitude.lt.${sw.lng},longitude.gt.${ne.lng}`);

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

    // 45도 섹터로 독점 분류하여 해당 방향 마커만 추출
    const inDir = data.filter((p: any) => {
      if (p.latitude == null || p.longitude == null) return false;
      if (p.latitude >= sw.lat && p.latitude <= ne.lat && p.longitude >= sw.lng && p.longitude <= ne.lng) return false;
      const dLat = (p.latitude - centerLat) / latRange;
      const dLng = (p.longitude - centerLng) / lngRange;
      if (dir === 'top')    return dLat >= 0 && dLat >= Math.abs(dLng);
      if (dir === 'bottom') return dLat < 0  && Math.abs(dLat) > Math.abs(dLng);
      if (dir === 'left')   return dLng < 0  && Math.abs(dLng) >= Math.abs(dLat);
      if (dir === 'right')  return dLng >= 0 && dLng > Math.abs(dLat);
      return false;
    });

    if (inDir.length === 0) return null;

    // 현재 지도 중심에서 유클리드 거리가 가장 가까운 포스팅
    let nearest = inDir[0];
    let minDist = Infinity;
    for (const p of inDir) {
      const d = Math.pow(p.latitude - center.lat, 2) + Math.pow(p.longitude - center.lng, 2);
      if (d < minDist) { minDist = d; nearest = p; }
    }

    return { lat: nearest.latitude, lng: nearest.longitude };
  } catch (err) {
    console.error('[SupabasePosts] fetchNearestInDirection error:', err);
    return null;
  }
};