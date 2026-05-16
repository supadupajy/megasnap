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
    const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('posts')
      .select('id, latitude, longitude, location_name, category, likes, created_at, video_url, video_urls, image_url, user_id, user_name, user_avatar, images, content, hot_since, profiles!posts_user_id_fkey(followers, nickname, avatar_url)')

      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .gte('created_at', oneDayAgoIso)
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const posts = data || [];
    if (posts.length === 0) return [];

    const postIds = posts.map((post: any) => post.id).filter(Boolean);
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [{ data: recentLikes, error: likesError }, { data: allComments, error: commentsError }] = await Promise.all([
      supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds)
        .gte('created_at', oneHourAgoIso),
      supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds),
    ]);

    if (likesError) throw likesError;
    if (commentsError) throw commentsError;

    const likesPerHourMap = new Map<string, number>();
    (recentLikes || []).forEach((like: any) => {
      const postId = String(like.post_id);
      likesPerHourMap.set(postId, (likesPerHourMap.get(postId) ?? 0) + 1);
    });

    const commentsCountMap = new Map<string, number>();
    (allComments || []).forEach((c: any) => {
      const postId = String(c.post_id);
      commentsCountMap.set(postId, (commentsCountMap.get(postId) ?? 0) + 1);
    });

    return posts.map((post: any) => ({
      ...post,
      likes_per_hour: likesPerHourMap.get(String(post.id)) ?? 0,
      comments_count: commentsCountMap.get(String(post.id)) ?? 0,
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
  points: { lat: number; lng: number }[];
}

export interface DirectionCounts {
  top: number;
  bottom: number;
  left: number;
  right: number;
  // 각 방향 마커들의 평균 위치 (물방울 방향 계산용)
  topAvgLat: number;
  topAvgLng: number;
  bottomAvgLat: number;
  bottomAvgLng: number;
  leftAvgLat: number;
  leftAvgLng: number;
  rightAvgLat: number;
  rightAvgLng: number;
  // 각 방향 마커 좌표 목록 (클릭 시 가장 가까운 마커로 이동용)
  topPoints: { lat: number; lng: number }[];
  bottomPoints: { lat: number; lng: number }[];
  leftPoints: { lat: number; lng: number }[];
  rightPoints: { lat: number; lng: number }[];
  // 하위 호환
  clusters: MarkerCluster[];
  hasTop: boolean;
  hasBottom: boolean;
  hasLeft: boolean;
  hasRight: boolean;
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
    clusters.push({ count: group.length, avgLat, avgLng, points: group.map(p => ({ lat: p.lat, lng: p.lng })) });
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
    // 마커 24시간 만료 룰: 지도에 표시되지 않는 만료 포스트는 OffScreenMarkerIndicator에서도 제외
    // (광고 마커는 ads 테이블에서 별도 관리되며 posts 테이블 쿼리 결과에는 포함되지 않음)
    const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
    const oneDayAgoIso = new Date(Date.now() - MARKER_LIFESPAN_MS).toISOString();

    const res = await applyFilters(
      supabase.from('posts').select('latitude, longitude')
        .or(`latitude.gt.${ne.lat},latitude.lt.${sw.lat},longitude.lt.${sw.lng},longitude.gt.${ne.lng}`)
        .gte('created_at', oneDayAgoIso)
    );

    if (res.error) throw res.error;

    let top = 0, bottom = 0, left = 0, right = 0;
    let hasTop = false, hasBottom = false, hasLeft = false, hasRight = false;

    const offScreenPoints: { lat: number; lng: number }[] = [];

    const topPts: { lat: number; lng: number }[] = [];
    const bottomPts: { lat: number; lng: number }[] = [];
    const leftPts: { lat: number; lng: number }[] = [];
    const rightPts: { lat: number; lng: number }[] = [];

    (res.data || []).forEach((p: any) => {
      if (p.latitude == null || p.longitude == null) return;
      if (p.latitude >= sw.lat && p.latitude <= ne.lat && p.longitude >= sw.lng && p.longitude <= ne.lng) return;

      offScreenPoints.push({ lat: p.latitude, lng: p.longitude });

      // 45도 섹터로 독점 분류
      const dLat = (p.latitude - centerLat) / latRange;
      const dLng = (p.longitude - centerLng) / lngRange;
      if      (dLat >= 0 && dLat >= Math.abs(dLng))           topPts.push({ lat: p.latitude, lng: p.longitude });
      else if (dLat < 0  && Math.abs(dLat) > Math.abs(dLng))  bottomPts.push({ lat: p.latitude, lng: p.longitude });
      else if (dLng < 0  && Math.abs(dLng) >= Math.abs(dLat)) leftPts.push({ lat: p.latitude, lng: p.longitude });
      else                                                      rightPts.push({ lat: p.latitude, lng: p.longitude });
    });

    const avg = (pts: { lat: number; lng: number }[], axis: 'lat' | 'lng', fallback: number) =>
      pts.length > 0 ? pts.reduce((s, p) => s + p[axis], 0) / pts.length : fallback;

    // 클러스터는 4방향 그대로 (하위 호환)
    const clusters: MarkerCluster[] = [];
    if (topPts.length > 0)    clusters.push({ count: topPts.length,    avgLat: avg(topPts, 'lat', centerLat),    avgLng: avg(topPts, 'lng', centerLng),    points: topPts });
    if (bottomPts.length > 0) clusters.push({ count: bottomPts.length, avgLat: avg(bottomPts, 'lat', centerLat), avgLng: avg(bottomPts, 'lng', centerLng), points: bottomPts });
    if (leftPts.length > 0)   clusters.push({ count: leftPts.length,   avgLat: avg(leftPts, 'lat', centerLat),   avgLng: avg(leftPts, 'lng', centerLng),   points: leftPts });
    if (rightPts.length > 0)  clusters.push({ count: rightPts.length,  avgLat: avg(rightPts, 'lat', centerLat),  avgLng: avg(rightPts, 'lng', centerLng),  points: rightPts });

    return {
      clusters,
      top: topPts.length, bottom: bottomPts.length, left: leftPts.length, right: rightPts.length,
      hasTop: topPts.length > 0, hasBottom: bottomPts.length > 0, hasLeft: leftPts.length > 0, hasRight: rightPts.length > 0,
      topAvgLat:    avg(topPts, 'lat', centerLat),    topAvgLng:    avg(topPts, 'lng', centerLng),
      bottomAvgLat: avg(bottomPts, 'lat', centerLat), bottomAvgLng: avg(bottomPts, 'lng', centerLng),
      leftAvgLat:   avg(leftPts, 'lat', centerLat),   leftAvgLng:   avg(leftPts, 'lng', centerLng),
      rightAvgLat:  avg(rightPts, 'lat', centerLat),  rightAvgLng:  avg(rightPts, 'lng', centerLng),
      topPoints: topPts, bottomPoints: bottomPts, leftPoints: leftPts, rightPoints: rightPts,
    };
  } catch (err) {
    console.error('[SupabasePosts] Off-screen counts fetch error:', err);
    return { clusters: [], top: 0, bottom: 0, left: 0, right: 0, hasTop: false, hasBottom: false, hasLeft: false, hasRight: false, topAvgLat: 0, topAvgLng: 0, bottomAvgLat: 0, bottomAvgLng: 0, leftAvgLat: 0, leftAvgLng: 0, rightAvgLat: 0, rightAvgLng: 0, topPoints: [], bottomPoints: [], leftPoints: [], rightPoints: [] };
  }
};

/**
 * 현재 bounds 안에서 24시간이 지난(만료된) 포스트들을 최신순으로 가져온다.
 * 지도에 "고스트(회색) 마커"로 잔상을 표시하기 위함이며,
 * 부하를 줄이기 위해 작은 limit (기본 30) + 마커에 필요한 최소 컬럼만 조회.
 */
export const fetchExpiredPostsInBounds = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  options?: { limit?: number; categories?: string[]; userId?: string | null; followingIds?: string[] }
): Promise<any[]> => {
  const { sw, ne } = bounds;
  const limit = options?.limit ?? 30;
  try {
    const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
    const oneDayAgoIso = new Date(Date.now() - MARKER_LIFESPAN_MS).toISOString();

    let query = supabase
      .from('posts')
      .select('id, latitude, longitude, image_url, video_url, video_urls, created_at, user_id, category')
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .lt('created_at', oneDayAgoIso)
      .order('created_at', { ascending: false })
      .limit(limit);

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

    const { data, error } = await query;
    if (error) throw error;
    // MapContainer가 사용하는 필드명으로 정규화 (lat, lng, image_url, videoUrl, createdAt)
    return (data || []).map((row: any) => ({
      id: row.id,
      lat: row.latitude,
      lng: row.longitude,
      image_url: row.image_url,
      videoUrl: row.video_url,
      videoUrls: Array.isArray(row.video_urls) ? row.video_urls : undefined,
      created_at: row.created_at,
      user_id: row.user_id,
      category: row.category,
    }));
  } catch (err) {
    console.error('[SupabasePosts] fetchExpiredPostsInBounds error:', err);
    return [];
  }
};

/**
 * 현재 bounds 안에 "24시간이 지나서 지도엔 안 보이지만 DB엔 남아있는" 포스트가
 * 하나라도 있는지 카운트한다. head: true + limit(1) 로 가장 가벼운 형태로 조회.
 *
 * "여기 보기" 버튼이 displayedPostCount === 0 일 때도, 이 카운트가 > 0 이면
 * "이 영역엔 시간이 지난 추억이 있다"는 힌트를 띄울 수 있다.
 */
export const fetchExpiredOnlyCountInBounds = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  options?: { categories?: string[]; userId?: string | null; followingIds?: string[] }
): Promise<number> => {
  const { sw, ne } = bounds;
  try {
    const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
    const oneDayAgoIso = new Date(Date.now() - MARKER_LIFESPAN_MS).toISOString();

    let query = supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('latitude', Math.min(sw.lat, ne.lat))
      .lte('latitude', Math.max(sw.lat, ne.lat))
      .gte('longitude', Math.min(sw.lng, ne.lng))
      .lte('longitude', Math.max(sw.lng, ne.lng))
      .lt('created_at', oneDayAgoIso);

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

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[SupabasePosts] fetchExpiredOnlyCountInBounds error:', err);
    return 0;
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
    // 24시간 만료 룰: 만료된 포스트는 인디케이터 클릭 이동 대상에서 제외
    const MARKER_LIFESPAN_MS = 24 * 60 * 60 * 1000;
    const oneDayAgoIso = new Date(Date.now() - MARKER_LIFESPAN_MS).toISOString();

    // 화면 밖 전체 포스팅을 가져와서 클라이언트에서 45도 섹터 독점 분류 후 가장 가까운 것 선택
    let query = supabase.from('posts').select('latitude, longitude')
      .or(`latitude.gt.${ne.lat},latitude.lt.${sw.lat},longitude.lt.${sw.lng},longitude.gt.${ne.lng}`)
      .gte('created_at', oneDayAgoIso);

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