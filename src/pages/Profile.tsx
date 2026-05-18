"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Settings, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

import CollapsingHeader from '@/components/CollapsingHeader';
import ProfileHeaderSkeleton from '@/components/ProfileHeaderSkeleton';
import ProfilePostsContent from '@/components/ProfilePostsContent';
import ProfileSavedPosts from '@/components/ProfileSavedPosts';
import ProfileStats from '@/components/ProfileStats';
import ProfileTabs, { ProfileViewMode } from '@/components/ProfileTabs';
import { useAuth } from '@/components/AuthProvider';
import { useCollapsingHeader } from '@/hooks/use-collapsing-header';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';
import { toggleLikeInDb } from '@/utils/like-utils';
import { mapDbToProfilePost, mapSavedAdToPost } from '@/utils/profile-posts';
import { showError, showSuccess } from '@/utils/toast';

const FALLBACK_IMAGE = '/placeholder.svg';

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading } = useAuth();

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [viewMode, setViewMode] = useState<ProfileViewMode>('grid');
  const [isDataLoading, setIsDataLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const postListStartRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const { scrollRef: collapsingScrollRef, progress: headerProgress } = useCollapsingHeader(80);

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (collapsingScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [collapsingScrollRef]);

  const userId = authUser?.id;
  const displayName = useMemo(
    () => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가',
    [profile, authUser]
  );
  const avatarUrl = useMemo(() => profile?.avatar_url || FALLBACK_IMAGE, [profile]);

  const loadProfileData = useCallback(async (uid: string) => {
    setIsDataLoading(true);

    try {
      const [myPostsRes, savedPostsRes, adSavedRes, followersRes, followingRes, profileRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, video_urls, created_at, user_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('saved_posts')
          .select('post_id, posts(id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, video_urls, created_at, user_id, profiles(nickname, avatar_url))')
          .eq('user_id', uid)
          .limit(20),
        supabase
          .from('ad_saved')
          .select('ad_id, created_at')
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

      const myPostIds = myData.map((post) => post.id);
      const savedPostIds = savedPostObjects.map((post: any) => post.id);
      const allPostIds = [...new Set([...myPostIds, ...savedPostIds])];

      let likedPostIds = new Set<string>();
      const savedPostIdSet = new Set<string>(savedPostIds);

      if (authUser?.id && allPostIds.length > 0) {
        const [{ data: likesData }, { data: extraSavedData }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', allPostIds),
          myPostIds.filter((id) => !savedPostIdSet.has(id)).length > 0
            ? supabase
                .from('saved_posts')
                .select('post_id')
                .eq('user_id', authUser.id)
                .in('post_id', myPostIds.filter((id) => !savedPostIdSet.has(id)))
            : Promise.resolve({ data: [] }),
        ]);

        likedPostIds = new Set((likesData || []).map((like) => like.post_id));
        (extraSavedData || []).forEach((saved: any) => savedPostIdSet.add(saved.post_id));
      }

      const initialMyPosts = myData.map((post) =>
        mapDbToProfilePost({
          post,
          authUserId: authUser?.id,
          displayName,
          avatarUrl,
          followerCount: profileFollowersVal > 0 ? profileFollowersVal : (followersRes.count || 0),
          isLiked: likedPostIds.has(post.id),
          isSaved: savedPostIdSet.has(post.id),
        })
      );

      const initialSavedPosts = savedPostObjects.map((post: any) =>
        mapDbToProfilePost({
          post,
          authUserId: authUser?.id,
          displayName,
          avatarUrl,
          followerCount: profileFollowersVal > 0 ? profileFollowersVal : (followersRes.count || 0),
          isLiked: likedPostIds.has(post.id),
          isSaved: savedPostIdSet.has(post.id),
        })
      );

      const adSavedItems = adSavedRes.data || [];
      let adSavedPosts: Post[] = [];

      if (adSavedItems.length > 0) {
        const adPostIds = adSavedItems.map((item: any) => item.ad_id as string);
        const adIds = adPostIds.map((id) => id.replace('ad-map-marker-', ''));

        const [{ data: adsData }, ...adStatsResults] = await Promise.all([
          supabase
            .from('ads')
            .select('id, brand_name, brand_logo_url, image_url, title, subtitle, link_url, lat, lng, updated_at')
            .in('id', adIds),
          ...adPostIds.map((adPostId) =>
            Promise.all([
              supabase.from('ad_likes').select('id', { count: 'exact', head: true }).eq('ad_id', adPostId),
              supabase.from('ad_comments').select('id', { count: 'exact', head: true }).eq('ad_id', adPostId),
              authUser?.id
                ? supabase.from('ad_likes').select('id').eq('ad_id', adPostId).eq('user_id', authUser.id).maybeSingle()
                : Promise.resolve({ data: null }),
            ])
          ),
        ]);

        adSavedPosts = (adsData || []).map((ad: any, index: number) =>
          mapSavedAdToPost({
            ad,
            stats: adStatsResults[index],
          })
        );
      }

      setMyPosts(initialMyPosts);
      setSavedPosts([...initialSavedPosts, ...adSavedPosts]);
    } catch (error) {
      console.error('[Profile] loadProfileData error:', error);
    } finally {
      setIsDataLoading(false);
    }
  }, [authUser?.id, avatarUrl, displayName]);

  useEffect(() => {
    if (!authLoading && authUser?.id) {
      loadProfileData(authUser.id);
    }
  }, [authLoading, authUser?.id, loadProfileData]);

  const handleTabChange = useCallback((mode: ProfileViewMode) => {
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

    const updatePost = (prev: Post[]) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        currentlyLiked = post.isLiked;
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
        };
      });

    setMyPosts(updatePost);
    setSavedPosts(updatePost);

    toggleLikeInDb(postId, authUser.id, currentlyLiked).then((ok) => {
      if (!ok) {
        const rollback = (prev: Post[]) =>
          prev.map((post) =>
            post.id !== postId
              ? post
              : {
                  ...post,
                  isLiked: currentlyLiked,
                  likes: currentlyLiked ? post.likes + 1 : post.likes - 1,
                }
          );

        setMyPosts(rollback);
        setSavedPosts(rollback);
      }
    });
  }, [authUser?.id]);

  const handleSaveToggle = useCallback((postId: string, nextSaved: boolean) => {
    setMyPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, isSaved: nextSaved } : post)));

    if (nextSaved) {
      setSavedPosts((prev) => {
        if (prev.some((post) => post.id === postId)) {
          return prev.map((post) => (post.id === postId ? { ...post, isSaved: true } : post));
        }

        const postToAdd = myPosts.find((post) => post.id === postId);
        return postToAdd ? [{ ...postToAdd, isSaved: true }, ...prev] : prev;
      });
      return;
    }

    setSavedPosts((prev) => prev.filter((post) => post.id !== postId));
  }, [myPosts]);

  const handleGridItemClick = useCallback((postId: string) => {
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
        const offset = elementTop - containerTop + container.scrollTop;
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }, 150);
  }, []);

  const handleImageError = useCallback((postId: string) => {
    setMyPosts((prev) => prev.filter((post) => post.id !== postId));
    setSavedPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);

  const handlePostDelete = useCallback(async (postId: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;

      setMyPosts((prev) => prev.filter((post) => post.id !== postId));
      setSavedPosts((prev) => prev.filter((post) => post.id !== postId));
      showSuccess('게시물이 삭제되었습니다.');
    } catch (error) {
      console.error('[Profile] Delete error:', error);
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  }, []);

  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number, post: Post) => {
    e.stopPropagation();
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;

    sessionStorage.setItem('pendingMapFocus', JSON.stringify({ lat, lng, postId: post.id }));
    navigate('/', { state: { post, center: { lat, lng } } });
  }, [navigate]);

  const handleViewOnMap = useCallback(() => {
    const postWithCoords = myPosts.find((post) => post.lat != null && post.lng != null && !Number.isNaN(post.lat) && !Number.isNaN(post.lng));

    if (postWithCoords) {
      sessionStorage.setItem(
        'pendingMapFocus',
        JSON.stringify({ lat: postWithCoords.lat, lng: postWithCoords.lng, postId: postWithCoords.id })
      );
      navigate('/', { state: { post: postWithCoords, center: { lat: postWithCoords.lat, lng: postWithCoords.lng } } });
      return;
    }

    navigate('/');
  }, [myPosts, navigate]);

  const handleScrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScrollToPosts = useCallback(() => {
    if (scrollRef.current && postListStartRef.current) {
      const tabBarEl = postListStartRef.current;
      const tabBarHeight = tabBarEl.offsetHeight;
      const postListTop = tabBarEl.offsetTop;
      const headerHeight = stickyHeaderRef.current?.offsetHeight ?? 0;

      scrollRef.current.scrollTo({
        top: postListTop + tabBarHeight - headerHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="h-screen w-full max-w-full flex flex-col overflow-x-hidden bg-white overscroll-x-none"
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div ref={stickyHeaderRef} className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-white pt-[64px]">
        <CollapsingHeader
          progress={headerProgress}
          Icon={UserIcon}
          iconBgClass="bg-indigo-100"
          iconColorClass="text-indigo-600"
          title="내 프로필"
          subtitle="My Activity"
          ActionIcon={Settings}
          onActionClick={() => navigate('/settings')}
          collapseActionToIcon
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white no-scrollbar overscroll-x-none" ref={setScrollRef}>
        {isDataLoading && myPosts.length === 0 ? (
          <ProfileHeaderSkeleton />
        ) : (
          <div className="p-6">
            <ProfileStats
              userId={userId}
              avatarUrl={avatarUrl}
              displayName={displayName}
              bio={profile?.bio}
              postsCount={myPosts.length}
              followerCount={followerCount}
              followingCount={followingCount}
              fallbackImage={FALLBACK_IMAGE}
              onPostsClick={handleScrollToPosts}
            />

            <Button
              onClick={() => navigate('/profile/edit')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-0"
            >
              프로필 편집
            </Button>

            <div ref={postListStartRef} className="bg-white -mx-6 px-6 mb-0">
              <ProfileTabs viewMode={viewMode} onChange={handleTabChange} />
            </div>

            <div className="flex flex-col -mx-6 pb-6">
              <div className={viewMode === 'saved' ? undefined : 'hidden'}>
                <ProfileSavedPosts
                  posts={savedPosts}
                  onLikeToggle={handleLikeToggle}
                  onSaveToggle={handleSaveToggle}
                  onLocationClick={handleLocationClick}
                  onOwnUserClick={handleScrollToTop}
                />
              </div>

              <div className={viewMode === 'saved' ? 'hidden' : undefined}>
                <ProfilePostsContent
                  viewMode={viewMode}
                  posts={myPosts}
                  onViewOnMap={handleViewOnMap}
                  onGridItemClick={handleGridItemClick}
                  onLikeToggle={handleLikeToggle}
                  onSaveToggle={handleSaveToggle}
                  onLocationClick={handleLocationClick}
                  onDelete={handlePostDelete}
                  onOwnUserClick={handleScrollToTop}
                  onImageError={handleImageError}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;