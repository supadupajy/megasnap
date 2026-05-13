"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Loader2, X } from 'lucide-react';
import { Post } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { getTierFromFollowers } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { toggleLikeInDb } from '@/utils/like-utils';
import { showError } from '@/utils/toast';
import CollapsingHeader from '@/components/CollapsingHeader';
import PostItem from '@/components/PostItem';
import AdMobBanner from '@/components/AdMobBanner';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';
import { mapCache } from '@/utils/map-cache';

interface NearbyPostsPayload {
  initialPosts: Post[];
  mapCenter: { lat: number; lng: number };
  currentBounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  selectedCategories: string[];
  openedViewedIds: string[];
  zoom?: number;
}

const STORAGE_KEY = 'nearby-posts-payload';
const PAGE_SIZE = 12;
const AD_INSERT_INTERVAL = 3;

const normalizePost = (post: any): Post => ({

  ...post,
  createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
});

const mapDbToPost = (p: any): Post => {
  const profile = p.profiles;
  const userName = profile?.nickname || p.user_name || '탐험가';
  const userAvatar = profile?.avatar_url || p.user_avatar || '/placeholder.svg';
  const borderType = p.hot_since ? 'popular' : getTierFromFollowers(Number(profile?.followers ?? 0));
  const finalImage = p.image_url || '/placeholder.svg';
  const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];

  return {
    id: p.id,
    user: { id: p.user_id, name: userName, avatar: userAvatar },
    content: p.content?.replace(/^\[AD\]\s*/, '') || '',
    location: p.location_name || '알 수 없는 장소',
    lat: p.latitude,
    lng: p.longitude,
    latitude: p.latitude,
    longitude: p.longitude,
    likes: Number(p.likes || 0),
    commentsCount: 0,
    comments: [],
    image: finalImage,
    image_url: finalImage,
    images: finalImages,
    videoUrl: p.video_url,
    createdAt: new Date(p.created_at),
    category: p.category || 'none',
    isLiked: false,
    isSaved: false,
    isAd: p.content?.trim().startsWith('[AD]') || false,
    isGif: false,
    isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
    borderType: borderType as any,
  };
};

const ViewedAwarePostItem = React.memo(({
  post,
  isViewed,
  hideBottomBorder = false,
  onVisible,
  onLikeToggle,
  onLocationClick,
  onDelete,
}: {
  post: Post;
  isViewed: boolean;
  hideBottomBorder?: boolean;
  onVisible: (id: string) => void;
  onLikeToggle: () => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete: (id: string) => void;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (post.isAd) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          observer.unobserve(entry.target);
        }
      },
      { threshold: [0.6], rootMargin: '-10% 0px -10% 0px' }
    );

    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [post.id, post.isAd, onVisible]);

  return (
    <div ref={itemRef} className={`${hideBottomBorder ? '' : 'border-b border-gray-100'} last:border-0 bg-white`}>
      <PostItem
        post={post}
        isViewed={isViewed}
        onLikeToggle={onLikeToggle}
        onLocationClick={onLocationClick}
        onDelete={onDelete}
        autoPlayVideo={true}
        disablePulse={true}
      />
    </div>
  );
});

const NearbyPosts = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { blockedIds } = useBlockedUsers();
  const { initialViewedIds, markAsViewed, hasLoadedViewedHistory } = useViewedPosts();
  const { scrollRef, progress } = useCollapsingHeader(80);

  const payload = useMemo<NearbyPostsPayload | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as NearbyPostsPayload;
      return {
        ...parsed,
        initialPosts: (parsed.initialPosts || []).map(normalizePost),
        openedViewedIds: parsed.openedViewedIds || [],
      };
    } catch {
      return null;
    }
  }, []);

  const [posts, setPosts] = useState<Post[]>(payload?.initialPosts || []);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!payload) navigate('/', { replace: true });
  }, [payload, navigate]);

  const [dividerViewedIds, setDividerViewedIds] = useState<Set<string>>(() => new Set(payload?.openedViewedIds || []));
  const hasCapturedDividerSnapshotRef = useRef((payload?.openedViewedIds?.length || 0) > 0);

  useEffect(() => {
    if (hasCapturedDividerSnapshotRef.current || !hasLoadedViewedHistory) return;

    hasCapturedDividerSnapshotRef.current = true;
    if (initialViewedIds.size > 0) {
      setDividerViewedIds(new Set(initialViewedIds));
    }
  }, [hasLoadedViewedHistory, initialViewedIds]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => post?.user && !blockedIds.has(post.user.id));
  }, [posts, blockedIds]);

  const visibleMapPostIds = useMemo(() => {
    return new Set((payload?.initialPosts || []).map(post => post.id));
  }, [payload?.initialPosts]);

  const displayPosts = useMemo(() => {
    if (dividerViewedIds.size === 0) return filteredPosts;

    const reorderByViewed = (group: Post[]) => {
      // 광고는 원래 자리(인덱스)를 유지하고, 일반 포스팅만 unseen → seen 순으로 재정렬한다.
      // 그렇지 않으면 광고가 항상 unseen 그룹에 묶여 상단으로 올라가는 문제가 생긴다.
      const nonAdQueue = group.filter(p => !p.isAd);
      const unseenNonAds = nonAdQueue.filter(p => !dividerViewedIds.has(p.id));
      const seenNonAds = nonAdQueue.filter(p => dividerViewedIds.has(p.id));
      const reorderedNonAds = [...unseenNonAds, ...seenNonAds];

      let cursor = 0;
      return group.map(post => {
        if (post.isAd) return post;
        const next = reorderedNonAds[cursor];
        cursor++;
        return next;
      });
    };

    const visiblePosts = filteredPosts.filter(post => visibleMapPostIds.has(post.id));
    const hiddenPosts = filteredPosts.filter(post => !visibleMapPostIds.has(post.id));

    return [...reorderByViewed(visiblePosts), ...reorderByViewed(hiddenPosts)];
  }, [filteredPosts, dividerViewedIds, visibleMapPostIds]);

  const loadMorePosts = useCallback(async () => {

    if (!payload || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const lastPost = posts[posts.length - 1];
      const lastPostDate = lastPost
        ? new Date(lastPost.createdAt).toISOString()
        : new Date().toISOString();

      const bounds = payload.currentBounds;
      const latMin = Math.min(bounds.sw.lat, bounds.ne.lat);
      const latMax = Math.max(bounds.sw.lat, bounds.ne.lat);
      const lngMin = Math.min(bounds.sw.lng, bounds.ne.lng);
      const lngMax = Math.max(bounds.sw.lng, bounds.ne.lng);

      let query = supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(followers, nickname, avatar_url)')
        .gte('latitude', latMin)
        .lte('latitude', latMax)
        .gte('longitude', lngMin)
        .lte('longitude', lngMax)
        .lt('created_at', lastPostDate)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (payload.selectedCategories.length > 0 && !payload.selectedCategories.includes('all')) {
        query = query.in('category', payload.selectedCategories);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      const newPosts = data.map(mapDbToPost);
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newPosts.filter(p => !existingIds.has(p.id));
        if (filteredNew.length === 0 || data.length < PAGE_SIZE) setHasMore(false);
        return [...prev, ...filteredNew];
      });
    } catch (error) {
      console.error('[NearbyPosts] loadMorePosts error:', error);
      showError('포스팅을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [payload, isLoadingMore, hasMore, posts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0 && hasMore) loadMorePosts();
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, hasMore]);

  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) {
      showError('로그인이 필요한 기능입니다.');
      return;
    }

    let currentlyLiked = false;
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      currentlyLiked = post.isLiked;
      return {
        ...post,
        isLiked: !post.isLiked,
        likes: !post.isLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
      };
    }));

    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        setPosts(prev => prev.map(post => post.id !== postId ? post : {
          ...post,
          isLiked: currentlyLiked,
          likes: currentlyLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
        }));
      }
    });
  }, [authUser?.id]);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number, post?: Post) => {
    e.stopPropagation();
    sessionStorage.setItem('pendingMapFocus', JSON.stringify({ lat, lng, postId: post?.id }));
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const firstHiddenMapPostIndex = displayPosts.findIndex(post => !post.isAd && !visibleMapPostIds.has(post.id));

  if (!payload) return null;

  const handleClose = () => {
    mapCache.keepPosition = true;

    mapCache.lastCenter = payload.mapCenter;
    if (payload.zoom != null) mapCache.lastZoom = payload.zoom;
    navigate('/', {
      state: {
        center: payload.mapCenter,
        zoom: payload.zoom,
      },
    });
  };

  return (
    <div ref={scrollRef} className="h-screen w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={progress}
          Icon={LayoutGrid}
          iconBgClass="bg-indigo-100"
          iconColorClass="text-indigo-600"
          title="여기 보기"
          subtitle={`Total ${posts.length} ${posts.length === 1 ? 'Post' : 'Posts'}`}
          ActionIcon={X}
          actionLabel="닫기"
          onActionClick={handleClose}
          collapseActionToIcon
        />
      </div>

      <div className="flex flex-col isolate">
        {(() => {
          const items: React.ReactNode[] = [];
          let postCount = 0;

          displayPosts.forEach((post, index) => {

            if (firstHiddenMapPostIndex !== -1 && index === firstHiddenMapPostIndex) {
              items.push(
                <div key="hidden-map-posts-divider" className="flex items-center gap-3 px-4 py-4 bg-white">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="rounded-full border border-gray-900 bg-gray-900 px-3 py-1 text-[11px] font-black text-white whitespace-nowrap shrink-0 shadow-sm">
                    지도에선 사라졌지만 영원히 남을 기록입니다.
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              );
            }

            items.push(
              <ViewedAwarePostItem

                key={post.id}
                post={post}
                isViewed={dividerViewedIds.has(post.id)}
                hideBottomBorder={index + 1 === firstHiddenMapPostIndex}
                onVisible={markAsViewed}
                onLikeToggle={() => handleLikeToggle(post.id)}
                onLocationClick={(e, lat, lng) => {
                  markAsViewed(post.id);
                  handleLocationClick(e, lat, lng, post);
                }}
                onDelete={handlePostDelete}
              />
            );

            if (!post.isAd) postCount++;
            if (postCount > 0 && postCount % AD_INSERT_INTERVAL === 0) {
              items.push(<AdMobBanner key={`ad-after-${post.id}`} />);
            }

          });

          return items;
        })()}

        {filteredPosts.length === 0 && (
          <div className="text-center py-20 text-gray-400 font-medium px-10">
            표시할 포스팅이 없습니다.
          </div>
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="py-10 flex justify-center">
            {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="py-8 text-center text-xs text-gray-400 font-medium">
            이 지역의 모든 포스팅을 불러왔습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default NearbyPosts;