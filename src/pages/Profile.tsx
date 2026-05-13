"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Settings,
  LayoutGrid,
  List,
  Bookmark,
  Map,
  User as UserIcon,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import PostItem from '@/components/PostItem';
import ProfileEditDrawer from '@/components/ProfileEditDrawer';
import VideoThumbnailPreview from '@/components/VideoThumbnailPreview';
import { Post } from '@/types';
import { cn, formatCount, getOptimizedMarkerImage } from '@/lib/utils';

import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

import { toggleLikeInDb } from '@/utils/like-utils';
import CollapsingHeader from '@/components/CollapsingHeader';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';

const FALLBACK_IMAGE = "/placeholder.svg";

const ProfileHeaderSkeleton = () => (
  <div className="p-6">
    <div className="flex items-center gap-6 mb-8">
      <Skeleton className="w-24 h-24 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-4 mt-4">
          <div className="text-center space-y-1"><Skeleton className="h-5 w-8 mx-auto" /><Skeleton className="h-3 w-10 mx-auto" /></div>
          <div className="text-center space-y-1"><Skeleton className="h-5 w-8 mx-auto" /><Skeleton className="h-3 w-14 mx-auto" /></div>
          <div className="text-center space-y-1"><Skeleton className="h-5 w-8 mx-auto" /><Skeleton className="h-3 w-14 mx-auto" /></div>
        </div>
      </div>
    </div>
    <Skeleton className="w-full h-11 rounded-xl mb-8" />
    <Skeleton className="h-px w-full mb-4" />
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-sm" />
      ))}
    </div>
  </div>
);

const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'saved' | 'list'>('grid');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const postListStartRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const { scrollRef: collapsingScrollRef, progress: headerProgress } = useCollapsingHeader(80);

  // 두 ref를 동일한 element에 연결하기 위한 콜백 ref
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (collapsingScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [collapsingScrollRef]);

  const userId = authUser?.id;
  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || '/placeholder.svg', [profile]);

  const isValidUrl = (url: any) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (/content\s*\d+/i.test(clean)) return false;
    if (/post\s*content/i.test(clean)) return false;
    if (!clean.startsWith('http')) return false;
    return true;
  };

  const SAFE_FALLBACK = "/placeholder.svg";

  const mapDbToPost = (p: any, isLiked = false, isSaved = false): Post => {
    let rawImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    let rawImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images.filter(isValidUrl)
      : [rawImage];
    if (rawImages.length === 0) rawImages = [rawImage];

    const isAd = p.content?.trim().startsWith('[AD]');
    let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';
    if (p.hot_since) {
      borderType = 'popular';
    } else if (!isAd) {
      borderType = getTierFromFollowers(followerCount) as any;
    }

    let finalImage = isValidUrl(rawImage) ? rawImage : SAFE_FALLBACK;
    let finalImages = rawImages.filter(isValidUrl);
    if (finalImages.length === 0) finalImages = [finalImage];

    return {
      id: p.id, isAd, isGif: false, isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user_id: p.user_id,
      owner_id: p.user_id,
      user: {
        id: p.user_id,
        name: p.user_id === authUser?.id ? displayName : (p.profiles?.nickname || p.user_name || '탐험가'),
        avatar: p.user_id === authUser?.id ? avatarUrl : (p.profiles?.avatar_url || p.user_avatar || '/placeholder.svg')
      },
      content: p.content?.replace(/^\[AD\]\s*/, '') || '',
      location: p.location_name || '알 수 없는 장소',
      lat: p.latitude, lng: p.longitude,
      latitude: p.latitude, longitude: p.longitude,
      likes: Number(p.likes || 0),
      commentsCount: 0, comments: [],
      image: finalImage, image_url: finalImage,
      images: finalImages,
      videoUrl: p.video_url,
      isLiked, isSaved,
      createdAt: new Date(p.created_at),
      borderType,
      category: p.category || 'none'
    };
  };

  const loadProfileData = useCallback(async (uid: string) => {
    setIsDataLoading(true);
    try {
      const [myPostsRes, savedPostsRes, followersRes, followingRes, profileRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('saved_posts')
          .select('post_id, posts(id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, profiles(nickname, avatar_url))')
          .eq('user_id', uid)
          .limit(20),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        supabase.from('profiles').select('followers').eq('id', uid).single(),
      ]);

      const profileFollowersVal = Number(profileRes.data?.followers ?? 0);
      setFollowerCount(profileFollowersVal > 0 ? profileFollowersVal : (followersRes.count || 0));
      setFollowingCount(followingRes.count || 0);

      const myData = myPostsRes.data || [];
      const savedPostObjects = (savedPostsRes.data || [])
        .filter((item: any) => item.posts)
        .map((item: any) => item.posts);

      const myPostIds = myData.map(p => p.id);
      const savedPostIds = savedPostObjects.map((p: any) => p.id);
      const allPostIds = [...new Set([...myPostIds, ...savedPostIds])];

      let likedPostIds = new Set<string>();
      const savedPostIdSet = new Set<string>(savedPostIds);

      if (authUser?.id && allPostIds.length > 0) {
        const [{ data: likesData }, { data: extraSavedData }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', allPostIds),
          myPostIds.filter(id => !savedPostIdSet.has(id)).length > 0
            ? supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).in('post_id', myPostIds.filter(id => !savedPostIdSet.has(id)))
            : Promise.resolve({ data: [] }),
        ]);
        likedPostIds = new Set((likesData || []).map(l => l.post_id));
        (extraSavedData || []).forEach((s: any) => savedPostIdSet.add(s.post_id));
      }

      const initialMyPosts = myData.map(p => mapDbToPost(p, likedPostIds.has(p.id), savedPostIdSet.has(p.id)));
      const initialSavedPosts = savedPostObjects.map((p: any) => mapDbToPost(p, likedPostIds.has(p.id), savedPostIdSet.has(p.id)));
      setMyPosts(initialMyPosts);
      setSavedPosts(initialSavedPosts);
      setIsDataLoading(false);

    } catch (err) {
      console.error('[Profile] loadProfileData error:', err);
      setIsDataLoading(false);
    }
  }, [authUser?.id, displayName, avatarUrl]);

  useEffect(() => {
    if (!authLoading && authUser?.id) {
      loadProfileData(authUser.id);
    }
  }, [authLoading, authUser?.id, loadProfileData]);

  // 탭 전환 시 스크롤 위치 보존
  const handleTabChange = useCallback((mode: 'grid' | 'list' | 'saved') => {
    const container = scrollRef.current;
    if (!container) {
      setViewMode(mode);
      return;
    }
    const currentScroll = container.scrollTop;
    flushSync(() => {
      setViewMode(mode);
    });
    container.scrollTop = currentScroll;
  }, []);

  const handleLikeToggle = useCallback((postId: string) => {
    if (!authUser?.id) return;
    let currentlyLiked = false;
    const updatePost = (prev: Post[]) => prev.map(post => {
      if (post.id !== postId) return post;
      currentlyLiked = post.isLiked;
      return { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 };
    });
    setMyPosts(updatePost);
    setSavedPosts(updatePost);
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        const rollback = (prev: Post[]) => prev.map(post => post.id !== postId ? post
          : { ...post, isLiked: currentlyLiked, likes: currentlyLiked ? post.likes + 1 : post.likes - 1 }
        );
        setMyPosts(rollback);
        setSavedPosts(rollback);
      }
    });
  }, [authUser?.id]);

  const handleSaveToggle = useCallback((postId: string, nextSaved: boolean) => {
    setMyPosts(prev => prev.map(p => p.id === postId ? { ...p, isSaved: nextSaved } : p));

    if (nextSaved) {
      setSavedPosts(prev => {
        if (prev.some(p => p.id === postId)) {
          return prev.map(p => p.id === postId ? { ...p, isSaved: true } : p);
        }

        const postToAdd = myPosts.find(p => p.id === postId);
        return postToAdd ? [{ ...postToAdd, isSaved: true }, ...prev] : prev;
      });
    } else {
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
    }
  }, [myPosts]);

  const handleGridItemClick = (postId: string) => {
    const container = scrollRef.current;
    const currentScroll = container?.scrollTop ?? 0;
    flushSync(() => {
      setViewMode('list');
    });
    if (container) container.scrollTop = currentScroll;
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      if (element && container) {
        const containerTop = container.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const offset = elementTop - containerTop + container.scrollTop - 30;
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }, 150);
  };

  const handleImageError = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handlePostDelete = useCallback(async (postId: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      setMyPosts(prev => prev.filter(p => p.id !== postId));
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
      showSuccess('게시물이 삭제되었습니다.');
    } catch (err) {
      console.error('[Profile] Delete error:', err);
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number, post: Post) => {
    e.stopPropagation();
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
    sessionStorage.setItem('pendingMapFocus', JSON.stringify({ lat, lng, postId: post.id }));
    navigate('/', { state: { post, center: { lat, lng } } });
  }, [navigate]);

  const handleViewOnMap = () => {
    const postWithCoords = myPosts.find(p => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng));
    if (postWithCoords) {
      sessionStorage.setItem('pendingMapFocus', JSON.stringify({ lat: postWithCoords.lat, lng: postWithCoords.lng, postId: postWithCoords.id }));
      navigate('/', { state: { post: postWithCoords, center: { lat: postWithCoords.lat, lng: postWithCoords.lng } } });
    } else {
      navigate('/');
    }
  };

  const handleScrollToPosts = () => {
    if (scrollRef.current && postListStartRef.current) {
      // 탭바 요소(postListStartRef) 다음 형제가 "지도에서 보기" 섹션을 포함한 컨텐츠 영역
      // "지도에서 보기" 섹션이 sticky 헤더 바로 아래에 딱 맞게 위치하도록 스크롤
      const tabBarEl = postListStartRef.current;
      const tabBarHeight = tabBarEl.offsetHeight;
      const postListTop = tabBarEl.offsetTop;
      const headerHeight = stickyHeaderRef.current?.offsetHeight ?? 0;
      // sticky 헤더 높이 + 탭바 높이만큼 빼주면, 탭바는 위로 스크롤되어 사라지고
      // "지도에서 보기" 섹션이 sticky 헤더 바로 아래에 딱 붙음 (모바일/웹 동일하게 동작)
      scrollRef.current.scrollTo({
        top: postListTop + tabBarHeight - headerHeight,
        behavior: 'smooth',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full max-w-full flex flex-col overflow-x-hidden bg-white overscroll-x-none" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* 상단 고정 헤더 */}
      <div ref={stickyHeaderRef} className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={headerProgress}
          Icon={UserIcon}
          iconBgClass="bg-indigo-100"
          iconColorClass="text-indigo-600"
          title="내 프로필"
          subtitle="My Activity"
          ActionIcon={Settings}
          actionLabel="설정"
          onActionClick={() => navigate('/settings')}
        />
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" ref={setScrollRef}>
        {isDataLoading && myPosts.length === 0 ? (
          <ProfileHeaderSkeleton />
        ) : (
          <div className="p-6">
            {/* 프로필 헤더 */}
            <div className="flex items-center gap-6 mb-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                  <img src={getOptimizedMarkerImage(avatarUrl, authUser?.id || 'profile')} alt="profile" loading="lazy" decoding="async" className="w-full h-full rounded-full object-cover border-4 border-white" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2>
                <p className="text-sm text-gray-500 mb-4">{profile?.bio || "지도를 여행하는 탐험가 📍"}</p>
                <div className="flex gap-4">
                  <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={handleScrollToPosts}>
                    <p className="font-bold text-gray-900">{formatCount(myPosts.length)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                  </div>
                  <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'followers' } })}>
                    <p className="font-bold text-gray-900">{formatCount(followerCount)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                  </div>
                  <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'following' } })}>
                    <p className="font-bold text-gray-900">{formatCount(followingCount)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-0">프로필 편집</Button>

            {/* 탭 바 */}
            <div ref={postListStartRef} className="bg-white -mx-6 px-6 mb-0">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => handleTabChange('grid')}
                  className={cn("flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px", viewMode === 'grid' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-300")}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-xs font-bold">그리드</span>
                </button>
                <button
                  onClick={() => handleTabChange('list')}
                  className={cn("flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px", viewMode === 'list' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-300")}
                >
                  <List className="w-4 h-4" />
                  <span className="text-xs font-bold">리스트</span>
                </button>
                <button
                  onClick={() => handleTabChange('saved')}
                  className={cn("flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px", viewMode === 'saved' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-300")}
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="text-xs font-bold">저장됨</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col -mx-6 pb-6">
              {/* 저장됨 탭 */}
              <div className={viewMode === 'saved' ? undefined : 'hidden'}>
                {savedPosts.map((post) => (
                  <div key={post.id} id={`post-saved-${post.id}`}>
                    <PostItem
                      post={post}
                      disablePulse={true}
                      autoPlayVideo={true}
                      onLikeToggle={() => handleLikeToggle(post.id)}
                      onSaveToggle={handleSaveToggle}
                      onLocationClick={(e, lat, lng) => handleLocationClick(e, lat, lng, post)}
                    />
                  </div>
                ))}
                {savedPosts.length === 0 && (
                  <div className="py-20 text-center text-gray-400 font-medium">저장된 포스팅이 없습니다.</div>
                )}
              </div>

              {/* 그리드/리스트 탭 — 항상 렌더링, hidden으로 숨김 */}
              <div className={viewMode === 'saved' ? 'hidden' : undefined}>
                <div onClick={handleViewOnMap} className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors">
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                    <Map className="w-4 h-4 fill-indigo-600" />지도에서 보기
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">나의 추억들을 지도에서 확인하세요</p>
                </div>

                {/* 리스트 뷰 — 항상 렌더링 */}
                <div className={viewMode === 'list' ? undefined : 'hidden'}>
                  {myPosts.map((post) => (
                    <div key={post.id} id={`post-${post.id}`}>
                      <PostItem
                        post={post}
                        disablePulse={true}
                        autoPlayVideo={true}
                        onLikeToggle={() => handleLikeToggle(post.id)}
                        onSaveToggle={handleSaveToggle}
                        onLocationClick={(e, lat, lng) => handleLocationClick(e, lat, lng, post)}
                        onDelete={() => handlePostDelete(post.id)}
                      />
                    </div>
                  ))}
                </div>

                {/* 그리드 뷰 — 항상 렌더링 */}
                <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-1 px-6' : 'hidden'}>
                  {myPosts.map((post) => (
                    <div
                      key={post.id}
                      className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
                      onClick={() => handleGridItemClick(post.id)}
                    >
                      {post.videoUrl ? (
                        <VideoThumbnailPreview
                          src={post.videoUrl}
                          className="w-full h-full object-cover hover:opacity-80 transition-opacity bg-gray-100"
                        />
                      ) : (
                        <img
                          src={getOptimizedMarkerImage(post.image_url || post.image, post.id)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                          onError={() => handleImageError(post.id)}
                        />
                      )}
                      {post.videoUrl && (
                        <div className="absolute top-2 right-2 z-10">
                          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
                        </div>
                      )}
                    </div>
                  ))}
                  {myPosts.length === 0 && (
                    <div className="col-span-3 py-20 text-center text-gray-400 font-medium">아직 등록된 포스팅이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;