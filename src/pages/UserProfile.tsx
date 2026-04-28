"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid,
  ChevronLeft,
  User as UserIcon,
  Play,
  UserCheck,
  UserPlus,
  MessageCircle,
  MoreHorizontal,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMediaBatch } from '@/utils/youtube-utils';
import { showSuccess, showError } from '@/utils/toast';
import { toggleLikeInDb } from '@/utils/like-utils';
import { Button } from '@/components/ui/button';
import PostItem from '@/components/PostItem';
import { Skeleton } from '@/components/ui/skeleton';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg';

// Skeleton UI for profile header
const ProfileSkeleton = () => (
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
    <div className="flex gap-2 mb-8">
      <Skeleton className="flex-1 h-11 rounded-xl" />
      <Skeleton className="flex-1 h-11 rounded-xl" />
    </div>
    <Skeleton className="h-px w-full mb-4" />
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-sm" />
      ))}
    </div>
  </div>
);

const UserProfile = () => {
  const { userId: profileUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { blockUser } = useBlockedUsers();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  const mapDbToPost = (
    p: any,
    likedSet: Set<string> = new Set(),
    savedSet: Set<string> = new Set()
  ): Post => {
    const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";
    const isValidUrl = (url: any) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      if (/post\s*content/i.test(clean)) return false;
      return clean.startsWith('http');
    };

    const finalImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    const finalImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images.filter(isValidUrl)
      : [finalImage];

    return {
      id: p.id,
      isAd: p.content?.trim().startsWith('[AD]') ?? false,
      isGif: false,
      isInfluencer: false,
      user: { id: p.user_id, name: p.user_name || '탐험가', avatar: p.user_avatar || `https://i.pravatar.cc/150?u=${p.user_id}` },
      content: p.content?.replace(/^\[AD\]\s*/, '') || '',
      location: p.location_name || '알 수 없는 장소',
      lat: p.latitude, lng: p.longitude,
      latitude: p.latitude, longitude: p.longitude,
      likes: Number(p.likes || 0), commentsCount: 0, comments: [],
      image: finalImage,
      image_url: finalImage,
      images: finalImages.length > 0 ? finalImages : [finalImage],
      youtubeUrl: p.youtube_url, videoUrl: p.video_url,
      isLiked: likedSet.has(p.id),
      isSaved: savedSet.has(p.id),
      createdAt: new Date(p.created_at),
      category: p.category || 'none'
    };
  };

  const toggleFollow = async () => {
    if (!authUser?.id || !profileUserId) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount(prev => next ? prev + 1 : prev - 1);
    if (next) {
      await supabase.from('follows').insert({ follower_id: authUser.id, following_id: profileUserId });
      showSuccess('팔로우를 시작했습니다.');
    } else {
      await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', profileUserId);
      showSuccess('팔로우를 취소했습니다.');
    }
  };

  const handleLikeToggle = (postId: string) => {
    if (!authUser?.id) return;
    let currentlyLiked = false;
    setUserPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      currentlyLiked = p.isLiked;
      return { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 };
    }));
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        setUserPosts(prev => prev.map(p => p.id !== postId ? p
          : { ...p, isLiked: currentlyLiked, likes: currentlyLiked ? p.likes + 1 : p.likes - 1 }
        ));
      }
    });
  };

  const handleGridItemClick = (postId: string) => {
    setViewMode('list');
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      const container = scrollRef.current;
      if (element && container) {
        const containerTop = container.getBoundingClientRect().top;
        const elementTop = element.getBoundingClientRect().top;
        const offset = elementTop - containerTop + container.scrollTop - 120;
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }, 150);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profileUserId) return;
      setLoading(true);

      try {
        // ✅ 모든 독립적인 쿼리를 동시에 실행
        const [
          profileRes,
          postsRes,
          followersRes,
          followingRes,
          followCheckRes,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, nickname, avatar_url, bio, last_seen')
            .eq('id', profileUserId)
            .single(),
          supabase
            .from('posts')
            .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar')
            .eq('user_id', profileUserId)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profileUserId),
          supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileUserId),
          authUser?.id
            ? supabase.from('follows').select('id').eq('follower_id', authUser.id).eq('following_id', profileUserId).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (profileRes.error) throw profileRes.error;
        setUserProfile(profileRes.data);
        setFollowerCount(followersRes.count || 0);
        setFollowingCount(followingRes.count || 0);
        setIsFollowing(!!followCheckRes.data);

        const posts = postsRes.data || [];
        const postIds = posts.map(p => p.id);

        // ✅ likes/saved 쿼리도 병렬로
        let likedSet = new Set<string>();
        let savedSet = new Set<string>();
        if (authUser?.id && postIds.length > 0) {
          const [{ data: likesData }, { data: savedData }] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', postIds),
            supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).in('post_id', postIds),
          ]);
          likedSet = new Set((likesData || []).map(l => l.post_id));
          savedSet = new Set((savedData || []).map(s => s.post_id));
        }

        // ✅ 즉시 렌더링: YouTube 검증 전에 먼저 표시
        const initialPosts = posts.map(p => mapDbToPost(p, likedSet, savedSet));
        setUserPosts(initialPosts);
        setLoading(false);

        // ✅ YouTube 검증은 백그라운드에서 배치 처리
        if (posts.some(p => p.youtube_url)) {
          sanitizeYoutubeMediaBatch(posts).then(sanitized => {
            const updatedPosts = sanitized.map(p => mapDbToPost(p, likedSet, savedSet));
            setUserPosts(updatedPosts);
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [profileUserId, authUser?.id]);

  if (!userProfile && !loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <UserIcon className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">사용자를 찾을 수 없습니다</h2>
        <Button onClick={() => navigate(-1)} variant="outline">뒤로 가기</Button>
      </div>
    );
  }

  const nickname = userProfile?.nickname || '탐험가';

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* 상단 고정 헤더 */}
      <div
        className="fixed left-0 right-0 z-40 bg-white border-b border-gray-100 flex items-center px-4 h-14"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
      >
        <button
          onClick={() => viewMode === 'list' ? setViewMode('grid') : navigate(-1)}
          className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">유저 프로필</h2>
        </div>
        {/* 쓰리닷 메뉴 - 본인 프로필이 아닐 때만 표시 */}
        {authUser?.id !== profileUserId && (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all outline-none">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 rounded-2xl p-1.5 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">
                <DropdownMenuItem
                  onClick={() => showSuccess('신고가 접수되었습니다.')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"
                >
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-bold text-gray-700">신고</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (profileUserId) {
                      blockUser(profileUserId);
                      showError('차단되었습니다.');
                      navigate(-1);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
                >
                  <Ban className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-bold text-red-600">차단</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* 스크롤 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-white pb-28 no-scrollbar"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 120px)' }}
      >
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
            {/* 프로필 정보 */}
            <div className="p-6">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600 flex-shrink-0">
                  <img src={userProfile?.avatar_url || FALLBACK_IMAGE} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-gray-900 mb-1">{nickname}</h2>
                  <p className="text-sm text-gray-500 mb-4">{userProfile?.bio || "지도를 여행하는 탐험가 📍"}</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="font-bold text-gray-900">{userPosts.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                    </div>
                    <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${profileUserId}`, { state: { tab: 'followers' } })}>
                      <p className="font-bold text-gray-900">{followerCount}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                    </div>
                    <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${profileUserId}`, { state: { tab: 'following' } })}>
                      <p className="font-bold text-gray-900">{followingCount}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mb-8">
                <Button onClick={toggleFollow} className={cn("flex-1 rounded-xl font-bold h-11", isFollowing ? "bg-gray-100 hover:bg-gray-200 text-gray-900" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100")}>
                  {isFollowing ? <><UserCheck className="w-4 h-4 mr-2" /> 팔로잉</> : <><UserPlus className="w-4 h-4 mr-2" /> 팔로우</>}
                </Button>
                <Button variant="outline" onClick={() => navigate(`/chat/${profileUserId}`)} className="flex-1 rounded-xl font-bold h-11 border-gray-200">
                  <MessageCircle className="w-4 h-4 mr-2" /> 메시지
                </Button>
              </div>

              {/* 탭 */}
              <div className="flex border-b border-gray-100 mb-4">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn("flex-1 py-3 flex justify-center transition-all", viewMode === 'grid' ? "border-b-2 border-indigo-600" : "text-gray-300")}
                >
                  <Grid className={cn("w-6 h-6", viewMode === 'grid' ? "text-indigo-600" : "")} />
                </button>
              </div>
            </div>

            {/* 포스트 목록 */}
            <div className="flex flex-col -mx-0">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-3 gap-1 px-6">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
                      onClick={() => handleGridItemClick(post.id)}
                    >
                      {post.videoUrl ? (
                        <video
                          src={`${post.videoUrl}#t=0.5`}
                          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={post.image_url || post.image}
                          alt=""
                          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                        />
                      )}
                      {(post.videoUrl || post.youtubeUrl) && (
                        <div className="absolute top-2 right-2 z-10">
                          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
                        </div>
                      )}
                      {Array.isArray(post.images) && post.images.length > 1 && (
                        <div className="absolute top-2 right-2 z-10 bg-black/50 rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="text-white text-[9px] font-bold">{post.images.length}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {userPosts.length === 0 && (
                    <div className="col-span-3 py-20 text-center text-gray-400 font-medium">게시물이 없습니다.</div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  {userPosts.map((post) => (
                    <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                      <PostItem
                        post={post}
                        disablePulse={true}
                        onLikeToggle={() => handleLikeToggle(post.id)}
                        onLocationClick={(e, lat, lng) => navigate('/', { state: { center: { lat, lng } } })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;