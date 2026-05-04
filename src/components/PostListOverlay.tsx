"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MapPin, MessageSquare, Clock, Filter, Loader2, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import PostItem from './PostItem';
import { Post } from '@/types';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds, getTierFromFollowers } from '@/hooks/use-supabase-posts';
import { showError } from '@/utils/toast';
import AdMobBanner from './AdMobBanner';

const ObservedPostItem = React.memo(({
  post, 
  onVisible, 
  isViewed, 
  onLikeToggle, 
  onLocationClick,
  onDelete,
  isPlaying,
  onPlayingChange
}: { 
  post: Post, 
  onVisible: (id: string) => void, 
  isViewed: boolean, 
  onLikeToggle: (id: string) => void, 
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number, fullPost: Post) => void,
  onDelete: (id: string) => void,
  isPlaying: boolean,
  onPlayingChange: (id: string, isIntersecting: boolean) => void
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isCurrentlyVisible, setIsCurrentlyVisible] = useState(false);
  const [isNearVisible, setIsNearVisible] = useState(false); // ✅ 화면 근처 도달 상태 추가
  const [fullPost, setFullPost] = useState<Post>(post);

  // ✅ [FIX] 화면에 보이기 전(근처 도달 시)에 상세 데이터를 미리 불러옴
  useEffect(() => {
    const fetchFullData = async () => {
      // user.name이 placeholder이거나, avatar가 없거나, location이 없으면 데이터를 새로 불러옴
      // '탐험가'도 profiles JOIN 없이 생성된 기본값이므로 재fetch 대상에 포함
      const needsFetch =
        fullPost.user.name === '...' ||
        fullPost.user.name === '탐험가' ||
        !fullPost.user.avatar ||
        !fullPost.location ||
        fullPost.location === '알 수 없는 장소';

      if (!needsFetch) return;

      try {
        // [Optimized] select('*') → 필요한 컬럼만 + profiles JOIN을 동일 쿼리에서 처리 (round-trip 1회)
        const { data: p, error } = await supabase
          .from('posts')
          .select('id, content, location_name, user_id, user_name, user_avatar, profiles:user_id(nickname, avatar_url)')
          .eq('id', post.id)
          .single();

        if (p && !error) {
          const profile = (p as any).profiles;
          const userName = profile?.nickname || p.user_name || '탐험가';
          const userAvatar = profile?.avatar_url || p.user_avatar || '/placeholder.svg';

          setFullPost(prev => ({

            ...prev,
            user: { ...prev.user, name: userName, avatar: userAvatar },
            content: p.content?.replace(/^\[AD\]\s*/, '') || '',
            location: p.location_name || '알 수 없는 장소'
          }));
        }
      } catch (err) {
        console.error('[PostList] Full data fetch error:', err);
      }
    };

    if (isNearVisible || isCurrentlyVisible) {
      fetchFullData();
    }
  }, [post.id, fullPost.user.name, fullPost.user.avatar, isNearVisible, isCurrentlyVisible]);

  useEffect(() => {
    // 1. 읽음 처리용 옵저버 (기존 로직 유지)
    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(post.id);
          viewObserver.unobserve(entry.target);
        }
      },
      { threshold: [0.6], rootMargin: '-10% 0px -10% 0px' }
    );

    // 2. 동영상 재생용 실시간 가시성 옵저버 (인스타그램 방식)
    const playbackObserver = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentlyVisible(entry.isIntersecting);
        onPlayingChange(post.id, entry.isIntersecting);
      },
      { 
        threshold: 0.2, // 20%만 보여도 로딩 시작 판단에 활용
        rootMargin: '0px'
      }
    );

    // 3. 프리로딩(Pre-loading)용 옵저버: 화면 아래 1000px 이내에 들어오면 로딩 시작
    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearVisible(true);
          preloadObserver.unobserve(entry.target);
        }
      },
      { 
        rootMargin: '0px 0px 1000px 0px' // 아래쪽으로 1000px 미리 감지
      }
    );

    if (itemRef.current) {
      viewObserver.observe(itemRef.current);
      playbackObserver.observe(itemRef.current);
      preloadObserver.observe(itemRef.current);
    }

    return () => {
      viewObserver.disconnect();
      playbackObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, [post.id, onVisible, onPlayingChange]);

  return (
    <div ref={itemRef} id={`post-${post.id}`} className="scroll-mt-0">
      <PostItem
        post={fullPost}
        isViewed={isViewed}
        onLikeToggle={onLikeToggle}
        onLocationClick={(e, lat, lng) => onLocationClick(e, lat, lng, fullPost)}
        onDelete={onDelete}
        autoPlayVideo={isCurrentlyVisible}
        isPlaying={isPlaying}
      />
    </div>
  );
});

interface PostListOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosts: Post[];
  mapCenter: { lat: number; lng: number };
  currentBounds?: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  selectedCategories: string[];
  authUserId?: string | null;
  onDeletePost?: (id: string) => void;
  openedViewedIds: Set<string>; // 오버레이가 열릴 때의 viewedIds 스냅샷 (외부에서 주입)
  viewedIds: Set<string>; // 실시간 viewedIds (부모에서 주입)
  markAsViewed: (id: string) => void; // 부모에서 주입
}

const PostListOverlay = ({ 
  isOpen, 
  onClose, 
  initialPosts, 
  mapCenter, 
  currentBounds, 
  selectedCategories,
  authUserId,
  onDeletePost,
  openedViewedIds,
  viewedIds,
  markAsViewed,
}: PostListOverlayProps) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── 뒤로가기 버튼으로 닫기 (Android/브라우저 back 버튼) ──────
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    history.pushState({ postListOverlayOpen: true }, '');
    const handlePopState = () => {
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // cleanup에서 history.back() 호출 금지 — popstate 이벤트가 다시 발생해
      // onClose가 중복 호출되는 순환 버그를 유발함
      // X버튼으로 닫을 때는 Index.tsx의 onClose에서 replaceState로 처리
    };
  }, [isOpen]);

  // ✅ 읽은 포스트들의 ID를 Set으로 관리하여 지도 마커 색상을 제어합니다.
  useEffect(() => {
    if (viewedIds.size > 0) {
      window.dispatchEvent(new CustomEvent('update-viewed-markers', { 
        detail: { viewedIds: Array.from(viewedIds) } 
      }));
    }
  }, [viewedIds]);
  
  // ✅ [FIX] 지도가 이동할 때마다 initialPosts가 바뀌므로, 이때 hasMore를 다시 true로 리셋해줘야 합니다.
  useEffect(() => {
    setPosts(initialPosts || []);
    setHasMore(true);
    setIsLoadingMore(false);
    // 새 목록으로 바뀌면 스크롤 맨 위로
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [initialPosts]);

  // Infinite Scroll Handler
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const lastPost = posts[posts.length - 1];
      const lastPostDate = lastPost 
        ? new Date(lastPost.createdAt).toISOString()
        : new Date().toISOString();

      // 현재 지도 화면 bounds 그대로 사용 (확장 없음)
      const latMin = Math.min(currentBounds.sw.lat, currentBounds.ne.lat);
      const latMax = Math.max(currentBounds.sw.lat, currentBounds.ne.lat);
      const lngMin = Math.min(currentBounds.sw.lng, currentBounds.ne.lng);
      const lngMax = Math.max(currentBounds.sw.lng, currentBounds.ne.lng);

      let { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hot_since, profiles!posts_user_id_fkey(followers)')
        .gte('latitude', latMin)
        .lte('latitude', latMax)
        .gte('longitude', lngMin)
        .lte('longitude', lngMax)
        .lt('created_at', lastPostDate)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      const userIds = Array.from(new Set(
        data.map((p: any) => p.user_id).filter((id: any) => !!id)
      ));

      let profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', userIds);
        (profilesData || []).forEach((pf: any) => {
          profileMap.set(pf.id, { nickname: pf.nickname, avatar_url: pf.avatar_url });
        });
      }

      const newPosts: Post[] = data.map((p: any) => {
        const profile = p.user_id ? profileMap.get(p.user_id) : null;
        const userName = profile?.nickname || p.user_name || '탐험가';
        const userAvatar = profile?.avatar_url || p.user_avatar || '';

        let borderType: string = 'none';
        if (p.hot_since) {
          borderType = 'popular';
        } else {
          borderType = getTierFromFollowers(Number(p.profiles?.followers ?? 0));
        }

        let finalImage = p.image_url || '/placeholder.svg';
        const finalImages = Array.isArray(p.images) && p.images.length > 0 ? p.images : [finalImage];

        return {
          id: p.id,
          user: { id: p.user_id, name: userName, avatar: userAvatar || '/placeholder.svg' },
          content: p.content || '',

          location: p.location_name || '알 수 없는 장소',
          lat: p.latitude, lng: p.longitude,
          latitude: p.latitude, longitude: p.longitude,
          likes: Number(p.likes || 0),
          image: finalImage,
          image_url: finalImage,
          images: finalImages,
          videoUrl: p.video_url,
          createdAt: new Date(p.created_at),
          category: p.category || 'none',
          commentsCount: 0, comments: [],
          isLiked: false, isAd: false, isGif: false,
          isInfluencer: borderType === 'silver' || borderType === 'gold' || borderType === 'diamond',
          borderType,
        };
      });

      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newPosts.filter(p => !existingIds.has(p.id));
        if (filteredNew.length === 0) setHasMore(false);
        return [...prev, ...filteredNew];
      });
    } catch (err) {
      console.error('[PostListOverlay] Regional fetch failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [posts, isLoadingMore, hasMore, currentBounds]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && posts.length > 0 && hasMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts, posts.length, hasMore]);

  // window 객체에 상태 기록 + BottomNav 동기화 이벤트 발생
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isPostListOpen = isOpen;
      window.dispatchEvent(
        new CustomEvent(isOpen ? 'open-post-list-overlay' : 'close-post-list-overlay')
      );
    }
  }, [isOpen]);

  const handlePlayingChange = (id: string, isIntersecting: boolean) => {
    if (isIntersecting) {
      setPlayingPostId(id);
    } else {
      setPlayingPostId(null);
    }
  };

  const handleLikeToggle = useCallback(async (postId: string) => {
    if (!authUserId) {
      showError('로그인이 필요한 기능입니다.');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.isLiked;
    
    // UI 즉시 반영 (Optimistic Update)
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const nextLiked = !isLiked;
      return { 
        ...p, 
        isLiked: nextLiked, 
        likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1) 
      };
    }));

    try {
      if (!isLiked) {
        await supabase.from('likes').upsert({ post_id: postId, user_id: authUserId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true });
        await supabase.rpc('increment_likes', { post_id: postId });
      } else {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', authUserId);
        await supabase.rpc('decrement_likes', { post_id: postId });
      }
    } catch (err) {
      console.error('[PostListOverlay] Like toggle error:', err);
    }
  }, [authUserId, posts]);

  // 2~3개 포스팅마다 광고를 삽입할 인덱스를 미리 계산 (posts가 바뀔 때만 재계산)
  const adIndices = useMemo(() => {
    const indices = new Set<number>();
    let postCount = 0;
    let nextAdAt = Math.floor(Math.random() * 2) + 2; // 2 또는 3
    posts.forEach((post, index) => {
      if (!post.isAd) {
        postCount++;
        if (postCount >= nextAdAt) {
          indices.add(index);
          postCount = 0;
          nextAdAt = Math.floor(Math.random() * 2) + 2;
        }
      }
    });
    return indices;
  }, [posts]);

  if (!isOpen) return null;

  // 구분선 위치 계산:
  // 광고(isAd)는 openedViewedIds에 항상 포함되어 있으므로 seen으로 취급됨
  // → unseen 일반 포스팅이 없으면 광고가 seen 영역 맨 앞에 오고, 구분선은 광고 앞에 표시됨
  const firstViewedIndex = posts.findIndex(p => openedViewedIds.has(p.id));

  return (
    <motion.div 
      initial={{ y: "100vh" }}
      animate={{ y: 0 }}
      exit={{ y: "100vh" }}
      transition={{ 
        type: 'tween', 
        duration: 0.35, 
        ease: [0.32, 0.72, 0, 1] 
      }}
      style={{ willChange: 'transform', bottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), 0px))' }}
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+64px)] z-[90] bg-white flex flex-col shadow-none overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 bg-white">
        <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                <LayoutGrid className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">여기 보기</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-transform"
            >
              <ChevronDown className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>
  

      {/* List Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-white custom-scrollbar touch-pan-y overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '24px'
        }}
      >
        {posts.length > 0 ? (
          <div className="flex flex-col">
            {(() => {
              const items: React.ReactNode[] = [];
              let adCount = 0;

              posts.forEach((post, index) => {
                // 이미 본 포스팅 구분선
                if (firstViewedIndex !== -1 && index === firstViewedIndex) {
                  items.push(
                    <div key="divider" className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-y border-gray-200">
                      <div className="flex-1 h-px bg-gray-300" />
                      <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap shrink-0">
                        여기서부터는 이미 조회한 포스팅입니다
                      </span>
                      <div className="flex-1 h-px bg-gray-300" />
                    </div>
                  );
                }

                items.push(
                  <ObservedPostItem
                    key={post.id}
                    post={post}
                    isViewed={viewedIds.has(post.id)}
                    onVisible={markAsViewed}
                    onLikeToggle={handleLikeToggle}
                    onLocationClick={(e, lat, lng, fullPost) => {
                      window.dispatchEvent(new CustomEvent('focus-post', { detail: { post: fullPost, lat, lng } }));
                    }}
                    onDelete={(id) => onDeletePost?.(id)}
                    isPlaying={playingPostId === post.id}
                    onPlayingChange={handlePlayingChange}
                  />
                );

                // 미리 계산된 인덱스에 해당하면 광고 삽입
                if (adIndices.has(index)) {
                  adCount++;
                  items.push(
                    <AdMobBanner key={`ad-${adCount}-${index}`} />
                  );
                }
              });

              return items;
            })()}
            
            {/* Infinite scroll sentinel */}
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <LayoutGrid className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-900 font-bold mb-1">표시할 포스팅이 없습니다</p>
            <p className="text-gray-400 text-xs">필터를 변경하거나 지도를 이동해보세요</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PostListOverlay;