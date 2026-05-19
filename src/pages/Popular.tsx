"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Flame, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';

import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';

import { fetchLikedPostIds, toggleLikeInDb } from '@/utils/like-utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import PostItem from '@/components/PostItem';
import AdMobBanner from '@/components/AdMobBanner';
import CollapsingHeader from '@/components/CollapsingHeader';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

const PAGE_SIZE = 15;
const AD_INSERT_INTERVAL = 3;

// 무한 스크롤 누적 상한.
// 한 세션에 너무 많은 카드(영상/이미지 포함)가 DOM에 쌓이면 모바일에서 메모리/페인트 부담이
// 누적되어 결국 버벅거림으로 이어진다. 인스타그램/유튜브 등도 사실상의 상한이 있으며,
// 사용자가 이 만큼 보고도 더 보려면 자연스럽게 탭 재진입(=새 셔플)로 유도된다.
//
// 상한은 "표시 가능한 인기 컨텐츠 카드 수"이며, 새 친구 컨텐츠(newFriendPosts)는
// 이 상한과 무관하게 항상 상단에 유지된다.
//
// 화면에 보이는 카드(트림 후보가 아님)는 절대 줄어들지 않으므로 스크롤 점프가 발생하지 않는다.
const MAX_DISPLAYED_POPULAR_CARDS = 90;

const PostSkeleton = () => (
  <div className="border-b border-gray-100 p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="w-full aspect-[9/16] rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    <div className="flex gap-4">
      <Skeleton className="h-8 w-16 rounded-full" />
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  </div>
);

// 친구 컨텐츠 - 조회 감지 컴포넌트
interface ViewedAwarePostItemProps {
  post: Post;
  isViewed?: boolean;
  onVisible: (id: string) => void;
  onLikeToggle: (id: string) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number) => void;
  onDelete: (id: string) => void;
  scrollRoot?: Element | null;
}

const ViewedAwarePostItemInner = ({
  post,
  isViewed,
  onVisible,
  onLikeToggle,
  onLocationClick,
  onDelete,
  scrollRoot,
}: ViewedAwarePostItemProps) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 광고는 조회수/열람 기록을 남기지 않는다.
    // 인기 컨텐츠/친구 컨텐츠 모두 화면에 노출되면 markAsViewed가 호출돼야
    // 조회수(post_views)가 카운트된다. (이전엔 친구 포스트일 때만 옵저버를
    // 만들어 인기 컨텐츠 스크롤로는 조회수가 절대 오르지 않는 버그가 있었음.)
    if (post.isAd) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          onVisible(post.id);
          observer.unobserve(entry.target);
        }
      },
      {
        root: scrollRoot ?? null,
        threshold: [0.5],
      }
    );

    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [post.id, post.isAd, onVisible, scrollRoot]);

  // PostItem이 React.memo로 감싸져 있어도 onLikeToggle 같은 콜백이 매 렌더링마다
  // 새 함수 참조로 들어오면 비교 비용이 누적된다. 부모(Popular)는 한 번만 만든
  // (id) => void 형태의 콜백을 넘기고, 여기서 그 콜백을 그대로 PostItem에 전달한다.
  // PostItem 내부에서는 인자 없이 호출하므로 () => onLikeToggle(post.id) 어댑터를 만든다.
  // 이 어댑터는 post.id가 같으면 의미상 동일하지만 참조는 새로 만들어진다.
  // 그래도 PostItem 자체가 memo + 커스텀 비교(콜백 제외)이므로 리렌더링은 막힌다.
  const handleLikeToggle = useCallback(() => {
    onLikeToggle(post.id);
  }, [onLikeToggle, post.id]);

  return (
    <div ref={itemRef} className="border-b border-gray-100 last:border-0 bg-white">
      <PostItem
        post={post}
        isViewed={isViewed}
        onLikeToggle={handleLikeToggle}
        onLocationClick={onLocationClick}
        onDelete={onDelete}
        autoPlayVideo={true}
        disablePulse={true}
      />
    </div>
  );
};

// 부모(Popular)가 setPosts로 배열을 새로 만들어 모든 자식이 새 props를 받더라도,
// post 내용/표시 상태가 변하지 않은 카드는 다시 그리지 않는다.
// 콜백은 useCallback으로 안정화되어 같은 참조를 유지하므로 비교에 안전하게 포함된다.
const areViewedAwarePropsEqual = (
  prev: ViewedAwarePostItemProps,
  next: ViewedAwarePostItemProps
): boolean => {
  if (prev.isViewed !== next.isViewed) return false;
  if (prev.scrollRoot !== next.scrollRoot) return false;
  if (prev.onVisible !== next.onVisible) return false;
  if (prev.onLikeToggle !== next.onLikeToggle) return false;
  if (prev.onLocationClick !== next.onLocationClick) return false;
  if (prev.onDelete !== next.onDelete) return false;

  const a = prev.post;
  const b = next.post;
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.id === b.id &&
    a.content === b.content &&
    a.isLiked === b.isLiked &&
    a.isSaved === b.isSaved &&
    a.likes === b.likes &&
    a.commentsCount === b.commentsCount &&
    a.image_url === b.image_url &&
    a.videoUrl === b.videoUrl &&
    a.images === b.images &&
    a.videoUrls === b.videoUrls &&
    a.isAd === b.isAd &&
    a.isFriendPost === b.isFriendPost
  );
};

const ViewedAwarePostItem = React.memo(
  ViewedAwarePostItemInner,
  areViewedAwarePropsEqual
);

const mapPost = (p: any, isFriend = false): Post => {
  const followers = Number(p.profiles?.followers ?? 0);
  const borderType = p.hot_since ? 'popular' : getTierFromFollowers(followers);
  const isAd = p.content?.trim().startsWith('[AD]');
  const finalImage = p.image_url || getFallbackImage(String(p.id));
  const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];
  return {
    id: p.id,
    user_id: p.user_id,
    owner_id: p.user_id,
    isAd,
    isGif: false,
    isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
    isFriendPost: isFriend,
    user: {
      id: p.user_id,
      name: p.profiles?.nickname || p.user_name || '사용자',
      avatar: p.profiles?.avatar_url || p.user_avatar || '',
    },
    content: p.content?.replace(/^\[AD\]\s*/, '') || '',
    location: p.location_name, lat: p.latitude, lng: p.longitude,
    likes: Number(p.likes || 0), commentsCount: 0, comments: [],
    image: finalImage, image_url: finalImage,
    images: finalImages,
    latitude: p.latitude, longitude: p.longitude,
    videoUrl: p.video_url,
    videoUrls: Array.isArray(p.video_urls) ? p.video_urls : undefined,
    isLiked: false, isSaved: false,
    createdAt: new Date(p.created_at),
    borderType: borderType as any,
    category: p.category || 'none',
  };
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const Popular = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { blockedIds } = useBlockedUsers();
  const { user: authUser, loading: authLoading } = useAuth();
  const { markAsViewed } = useViewedPosts();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sessionNewFriendIds, setSessionNewFriendIds] = useState<Set<string>>(new Set());

  const { scrollRef, progress } = useCollapsingHeader(80);

  const mergedPoolRef = useRef<Post[]>([]);
  const newFriendPostsRef = useRef<Post[]>([]);
  const displayedCountRef = useRef(0);
  const isLoadingRef = useRef(false);
  const lastLocationKeyRef = useRef<string>('');

  const isLoading = authLoading || (isInitialLoading && posts.length === 0);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(p => p && p.user && !blockedIds.has(p.user.id));
  }, [posts, blockedIds]);

  const buildAndLoad = useCallback(async (userId: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsInitialLoading(true);

    try {
      // 1) 현재 시점의 열람 기록을 DB에서 직접 조회
      const { data: viewedData } = await supabase
        .from('viewed_posts')
        .select('post_id')
        .eq('user_id', userId);

      const currentViewedIds = new Set<string>((viewedData || []).map((v: any) => v.post_id));

      // 2) 팔로잉 목록 (인기 컨텐츠 매핑 시 친구 여부 판별에 사용)
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = (followsData || []).map((f: any) => f.following_id);
      const followingIdSet = new Set<string>(followingIds);

      // 3) 인기 컨텐츠 200개 (랜덤 셔플)
      // 인기 컨텐츠에 포함된 포스트라도 작성자가 팔로잉 대상이면 친구로 표시
      const { data: popularData, error: popularError } = await supabase.rpc('get_popular_posts', { limit_count: 200 });
      if (popularError) throw popularError;

      const shuffledPopular: Post[] = shuffle(
        (popularData || []).map((p: any) => mapPost(p, followingIdSet.has(p.user_id)))
      );

      // 4) 친구 포스팅 fetch
      let allFriendPosts: Post[] = [];

      if (followingIds.length > 0) {
        const { data: friendData } = await supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, video_urls, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(nickname, avatar_url, followers)')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(500);

        allFriendPosts = (friendData || []).map((p: any) => mapPost(p, true));

        if (allFriendPosts.length > 0) {
          const likedIds = await fetchLikedPostIds(allFriendPosts.map(p => p.id), userId);
          allFriendPosts = allFriendPosts.map((p): Post => ({ ...p, isLiked: likedIds.has(String(p.id)) }));
        }
      }

      // 4) 인기 컨텐츠 좋아요 상태 반영
      let finalPopular: Post[] = shuffledPopular;
      if (finalPopular.length > 0) {
        const likedIds = await fetchLikedPostIds(finalPopular.map(p => p.id), userId);
        finalPopular = finalPopular.map((p): Post => ({ ...p, isLiked: likedIds.has(String(p.id)) }));
      }

      // 5) 새 친구 컨텐츠 (미열람) → 상단 고정
      const newFriendPosts = allFriendPosts
        .filter(p => !currentViewedIds.has(p.id))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 6) 열람된 친구 컨텐츠 + 인기 컨텐츠 → created_at 혼합 정렬
      const viewedFriendPosts = allFriendPosts.filter(p => currentViewedIds.has(p.id));

      const combined: Post[] = ([...finalPopular, ...viewedFriendPosts] as Post[])
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const seenIds = new Set<string>();
      const deduped: Post[] = combined.filter(p => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      newFriendPostsRef.current = newFriendPosts;
      mergedPoolRef.current = deduped;
      displayedCountRef.current = 0;

      setSessionNewFriendIds(new Set(newFriendPosts.map(p => p.id)));

      const initial = deduped.slice(0, PAGE_SIZE);
      displayedCountRef.current = initial.length;
      setPosts([...newFriendPosts, ...initial]);
      setHasMore(deduped.length > PAGE_SIZE);

    } catch (err) {
      mergedPoolRef.current = [];
      newFriendPostsRef.current = [];
    } finally {
      setIsInitialLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // location.key가 바뀔 때마다 재빌드 (탭 복귀 감지)
  // lastLocationKeyRef로 중복 실행 방지
  useEffect(() => {
    if (authLoading || !authUser?.id) return;
    if (lastLocationKeyRef.current === location.key) return;
    lastLocationKeyRef.current = location.key;
    buildAndLoad(authUser.id);
  }, [authLoading, authUser?.id, location.key, buildAndLoad]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const next = mergedPoolRef.current.slice(displayedCountRef.current, displayedCountRef.current + PAGE_SIZE);
    if (next.length > 0) {
      displayedCountRef.current += next.length;
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const merged = [...prev, ...next.filter(p => !existingIds.has(p.id))];

        // ─ 누적 카드 상한 적용 ─
        // 표시 중인 인기/열람 친구 컨텐츠 카드가 너무 많이 쌓이면 모바일에서
        // 페인트/메모리 부담이 누적된다. 새 친구 컨텐츠는 상단에 분리되어 있고,
        // 트림은 항상 \"리스트의 더 위쪽(=화면에서 멀리 지나간 카드)\" 에서만
        // 일어나므로 사용자가 현재 보고 있는 위치보다 위 영역만 정리된다.
        //
        // 트림이 일어나는 시점은 무한 스크롤로 새 카드가 들어올 때뿐이고, 그 시점에는
        // 사용자가 더 \"아래쪽\"을 보고 있는 게 확실하므로 시각적으로 영향 없음.
        const newFriendCount = newFriendPostsRef.current.length;
        const popularCount = merged.length - newFriendCount;
        if (popularCount > MAX_DISPLAYED_POPULAR_CARDS) {
          const excess = popularCount - MAX_DISPLAYED_POPULAR_CARDS;
          // 새 친구 컨텐츠는 보존하고, 그 다음(=상단 가장 오래된 인기/열람 친구 카드)부터 잘라낸다.
          return [
            ...merged.slice(0, newFriendCount),
            ...merged.slice(newFriendCount + excess),
          ];
        }
        return merged;
      });
      setHasMore(displayedCountRef.current < mergedPoolRef.current.length);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && posts.length > 0 && hasMore) loadMore(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, posts.length, hasMore]);

  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) return;
    let currentlyLiked = false;
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      currentlyLiked = post.isLiked;
      return { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 };
    }));
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        setPosts(prev => prev.map(post => post.id !== postId ? post
          : { ...post, isLiked: currentlyLiked, likes: currentlyLiked ? post.likes + 1 : post.likes - 1 }
        ));
      }
    });
  }, [authUser?.id]);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    const post = posts.find(p => p.lat === lat && p.lng === lng);
    navigate('/', { state: { center: { lat, lng }, post } });
  }, [navigate, posts]);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  return (
    <div ref={scrollRef} className="h-screen w-full max-w-full overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={progress}
          Icon={Flame}
          iconBgClass="bg-orange-100"
          iconColorClass="text-orange-600"
          iconFilled
          title="인기 컨텐츠"
          subtitle="Trending Now"
          ActionIcon={Search}
          onActionClick={() => navigate('/post-search')}
          collapseActionToIcon
        />
      </div>

      <div>
        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}
          </div>
        ) : (
          <div className="flex flex-col">
            {(() => {
              const items: React.ReactNode[] = [];
              let postCount = 0;

              filteredPosts.forEach((post) => {
                items.push(
                  <ViewedAwarePostItem
                    key={post.id}
                    post={post}
                    isViewed={post.isFriendPost ? !sessionNewFriendIds.has(post.id) : undefined}
                    scrollRoot={scrollRef.current}
                    onVisible={markAsViewed}
                    // 인자 없는 인라인 () => handleLikeToggle(post.id) 대신 (id)=>void 그대로 전달.
                    // useCallback으로 안정된 참조이므로 memo 비교가 정상 동작한다.
                    onLikeToggle={handleLikeToggle}
                    onLocationClick={handleLocationClick}
                    onDelete={handlePostDelete}
                  />
                );

                postCount++;

                if (postCount % AD_INSERT_INTERVAL === 0) {
                  items.push(
                    <AdMobBanner key={`ad-after-${post.id}`} />
                  );
                }
              });

              return items;
            })()}

            {!isLoading && filteredPosts.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-medium px-10">
                표시할 인기 컨텐츠가 없습니다.
              </div>
            )}

            {hasMore && (
              <div ref={loadMoreRef} className="py-10 flex justify-center">
                {isLoadingMore && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                모든 컨텐츠를 불러왔습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popular;
