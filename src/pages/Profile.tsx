"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, Grid, Bookmark, User as UserIcon, ChevronLeft, Play, Map, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import ProfileEditDrawer from '@/components/ProfileEditDrawer';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const hasFetched = useRef(false);

  const userId = authUser?.id;
  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`, [profile, userId]);

  const getTierFromId = (id: string) => {
    let h = 0;
    for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
    const val = Math.abs(h % 1000) / 1000;
    if (val < 0.01) return 'diamond';
    if (val < 0.03) return 'gold';
    if (val < 0.07) return 'silver';
    if (val < 0.15) return 'popular';
    return 'none';
  };

  const mapDbToPost = async (p: any): Promise<Post> => {
    const sanitized = await sanitizeYoutubeMedia(p);
    const isAd = sanitized.content?.trim().startsWith('[AD]');
    const borderType = isAd ? 'none' : getTierFromId(sanitized.id);
    
    const finalImage = sanitized.youtube_url 
      ? (getYoutubeThumbnail(sanitized.youtube_url) || sanitized.image_url)
      : remapUnsplashDisplayUrl(sanitized.image_url, sanitized.id, isAd ? 'food' : 'general') || sanitized.image_url;

    return {
      id: sanitized.id,
      isAd,
      isGif: false,
      isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user: {
        id: sanitized.user_id,
        name: sanitized.user_name || '탐험가',
        avatar: sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}`
      },
      content: sanitized.content?.replace(/^\[AD\]\s*/, '') || '',
      location: sanitized.location_name || '알 수 없는 장소',
      lat: sanitized.latitude,
      lng: sanitized.longitude,
      likes: Number(sanitized.likes || 0),
      commentsCount: 0,
      comments: [],
      image: finalImage,
      youtubeUrl: sanitized.youtube_url,
      videoUrl: sanitized.video_url,
      isLiked: false,
      isSaved: true,
      createdAt: new Date(sanitized.created_at),
      borderType
    };
  };

  const loadProfileData = useCallback(async (uid: string) => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    setIsDataLoading(true);

    try {
      // 1. 내 게시물 가져오기
      const { data: myData, error: myError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (myError) throw myError;
      const formattedMyPosts = await Promise.all((myData || []).map(mapDbToPost));
      setMyPosts(formattedMyPosts);

      // 2. 저장된 게시물 가져오기
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id, posts(*)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;
      
      const formattedSavedPosts = await Promise.all(
        (savedData || [])
          .filter(item => item.posts)
          .map(item => mapDbToPost(item.posts))
      );
      setSavedPosts(formattedSavedPosts);

      // 3. 팔로워/팔로잉 카운트 가져오기
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid)
      ]);

      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);

    } catch (err) {
      console.error('[Profile] Data load error:', err);
      hasFetched.current = false;
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && authUser?.id) {
      loadProfileData(authUser.id);
    }
  }, [authLoading, authUser?.id, loadProfileData]);

  const handleLikeToggle = useCallback((postId: string, isFromSaved: boolean) => {
    const setter = isFromSaved ? setSavedPosts : setMyPosts;
    setter(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleGridItemClick = (postId: string) => {
    setViewMode(viewMode === 'gifs' ? 'gif-list' : 'list');
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleImageError = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setMyPosts(prev => prev.filter(p => p.id !== postId));
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleViewOnMap = () => {
    const latestPost = myPosts[0];
    navigate('/', { 
      state: { 
        filterUserId: 'me',
        post: latestPost,
        center: latestPost ? { lat: latestPost.lat, lng: latestPost.lng } : undefined
      } 
    });
  };

  if (authLoading || (authUser && isDataLoading && myPosts.length === 0 && savedPosts.length === 0)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-gray-400">프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <Header />
      <div className="pt-[88px]">
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                <UserIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">내 프로필</h2>
                <p className="text-xs text-gray-400 font-medium">나의 활동과 기록을 확인하세요</p>
              </div>
            </div>
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
                <img 
                  src={avatarUrl} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white" 
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} 
                />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2>
              <p className="text-sm text-gray-500 mb-4">{profile?.bio || "지도를 여행하는 탐험가 📍"}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{myPosts.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                </div>
                <div 
                  className="text-center cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'followers' } })}
                >
                  <p className="font-bold text-gray-900">{followerCount.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                </div>
                <div 
                  className="text-center cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'following' } })}
                >
                  <p className="font-bold text-gray-900">{followingCount.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">프로필 편집</Button>

          <div className="flex border-b border-gray-100 mb-4">
            <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600" : "text-gray-300")}><Grid className={cn("w-6 h-6", (viewMode === 'grid' || viewMode === 'list') ? "text-indigo-600" : "")} /></button>
            <button onClick={() => setViewMode('gifs')} className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'gifs' || viewMode === 'gif-list') ? "border-b-2 border-indigo-600" : "text-gray-300")}><Play className={cn("w-6 h-6", (viewMode === 'gifs' || viewMode === 'gif-list') ? "text-indigo-600" : "")} /></button>
            <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center transition-all", viewMode === 'saved' ? "border-b-2 border-indigo-600" : "text-gray-300")}><Bookmark className={cn("w-6 h-6", viewMode === 'saved' ? "text-indigo-600" : "")} /></button>
          </div>

          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <>
                <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4"><h3 className="text-sm font-black text-indigo-600 flex items-center gap-2"><Bookmark className="w-4 h-4 fill-indigo-600" />저장된 포스팅</h3><p className="text-[10px] text-indigo-400 font-bold mt-0.5">다른 탐험가들의 멋진 기록들</p></div>
                {savedPosts.map((post) => (<div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]"><PostItem id={post.id} user={post.user} content={post.content} location={post.location} likes={post.likes} commentsCount={post.commentsCount} comments={post.comments} image={post.image} images={post.images} isLiked={post.isLiked} isAd={post.isAd} isGif={post.isGif} isInfluencer={post.isInfluencer} borderType={post.borderType} disablePulse={true} onLikeToggle={() => handleLikeToggle(post.id, true)} onImageError={() => handleImageError(post.id)} /></div>))}
                {savedPosts.length === 0 && !isDataLoading && (<div className="py-20 text-center text-gray-400 font-medium">저장된 포스팅이 없습니다.</div>)}
              </>
            ) : (
              <>
                <div onClick={handleViewOnMap} className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors"><h3 className="text-sm font-black text-indigo-600 flex items-center gap-2"><Map className="w-4 h-4 fill-indigo-600" />지도에서 보기</h3><p className="text-[10px] text-indigo-400 font-bold mt-0.5">나의 추억들을 지도에서 확인하세요</p></div>
                {(viewMode === 'list' || viewMode === 'gif-list') ? (
                  <div className="flex flex-col">{(viewMode === 'gif-list' ? myPosts.filter(p => p.isGif) : myPosts).map((post) => (<div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]"><PostItem id={post.id} user={post.user} content={post.content} location={post.location} likes={post.likes} commentsCount={post.commentsCount} comments={post.comments} image={post.image} images={post.images} isLiked={post.isLiked} isAd={post.isAd} isGif={post.isGif} isInfluencer={post.isInfluencer} borderType={post.borderType} disablePulse={true} onLikeToggle={() => handleLikeToggle(post.id, false)} onDelete={handlePostDelete} onImageError={() => handleImageError(post.id)} /></div>))}</div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 px-6">{(viewMode === 'gifs' ? myPosts.filter(p => p.isGif) : myPosts).map((post) => (<div key={post.id} className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group" onClick={() => handleGridItemClick(post.id)}><img src={post.image} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" onError={() => handleImageError(post.id)} /></div>))}{myPosts.length === 0 && !isDataLoading && (<div className="col-span-3 py-20 text-center text-gray-400 font-medium">아직 등록된 포스팅이 없습니다.</div>)}</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;