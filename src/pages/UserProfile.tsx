"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Grid, Bookmark, User as UserIcon, Play, Loader2, UserPlus, UserCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail, getFallbackImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';
import PostItem from '@/components/PostItem';

const FALLBACK_IMAGE = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";

const UserProfile = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const [userData, setUserData] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [isDataLoading, setIsDataLoading] = useState(false);

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
    const SAFE_FALLBACK = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";

    const isValidUrl = (url: any) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      if (/post\s*content/i.test(clean)) return false;
      if (!clean.startsWith('http')) return false;
      return true;
    };

    let rawImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    let rawImages = Array.isArray(p.images) && p.images.length > 0 ? p.images.filter(isValidUrl) : [];
    if (rawImages.length === 0) rawImages = [rawImage];

    const sanitized = await sanitizeYoutubeMedia({ ...p, image_url: rawImage, images: rawImages });
    const isAd = sanitized.content?.trim().startsWith('[AD]');
    const borderType = isAd ? 'none' : getTierFromId(sanitized.id);
    
    let finalImage = isValidUrl(sanitized.image_url) ? sanitized.image_url : SAFE_FALLBACK;
    if (finalImage.includes('unsplash.com')) {
      finalImage = remapUnsplashDisplayUrl(finalImage, sanitized.id, isAd ? 'food' : (sanitized.category || 'general')) || finalImage;
    }
    
    let finalImages = Array.isArray(sanitized.images) && sanitized.images.length > 0 ? sanitized.images.filter(isValidUrl) : [finalImage];

    let isLiked = false;
    let isSaved = false;
    
    if (authUser?.id) {
      const [{ data: likeData }, { data: saveData }] = await Promise.all([
        supabase.from('likes').select('id').eq('post_id', sanitized.id).eq('user_id', authUser.id).maybeSingle(),
        supabase.from('saved_posts').select('id').eq('post_id', sanitized.id).eq('user_id', authUser.id).maybeSingle()
      ]);
      isLiked = !!likeData;
      isSaved = !!saveData;
    }

    return {
      id: sanitized.id, isAd, isGif: false, isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user: { id: sanitized.user_id, name: sanitized.user_name || '탐험가', avatar: sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}` },
      content: sanitized.content?.replace(/^\[AD\]\s*/, '') || '', location: sanitized.location_name || '알 수 없는 장소', lat: sanitized.latitude, lng: sanitized.longitude,
      likes: Number(sanitized.likes || 0), commentsCount: 0, comments: [], 
      image: finalImage, 
      images: finalImages.length > 0 ? finalImages : [finalImage], 
      youtubeUrl: sanitized.youtube_url, videoUrl: sanitized.video_url,
      isLiked, isSaved, createdAt: new Date(sanitized.created_at), borderType,
      category: sanitized.category || 'none'
    };
  };

  const fetchUserData = useCallback(async (uid: string) => {
    setIsDataLoading(true);
    try {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', uid).single();
      setUserData(profileData);

      const { data: postsData } = await supabase.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const formattedPosts = await Promise.all((postsData || []).map(mapDbToPost));
      setUserPosts(formattedPosts);

      const { data: savedData } = await supabase.from('saved_posts').select('posts (*)').eq('user_id', uid);
      const validSaved = (savedData || []).filter((item: any) => item.posts).map((item: any) => item.posts);
      const formattedSaved = await Promise.all(validSaved.map(mapDbToPost));
      setSavedPosts(formattedSaved);

      if (authUser) {
        const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', authUser.id).eq('following_id', uid).maybeSingle();
        setIsFollowing(!!followData);
      }

      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid)
      ]);
      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDataLoading(false);
    }
  }, [authUser]);

  useEffect(() => { 
    if (userId) fetchUserData(userId); 
  }, [userId, fetchUserData]);

  const handleLikeToggle = (postId: string) => {
    setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: !p.isLiked ? p.likes + 1 : p.likes - 1 } : p));
  };

  const toggleFollow = async () => {
    if (!authUser || !userId) return;
    const prevFollowing = isFollowing;
    setIsFollowing(!prevFollowing);
    setFollowerCount(prev => prevFollowing ? prev - 1 : prev + 1);
    try {
      if (prevFollowing) {
        await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', userId);
      } else {
        await supabase.from('follows').insert({ follower_id: authUser.id, following_id: userId });
      }
    } catch (err) {
      setIsFollowing(prevFollowing);
      setFollowerCount(prev => prevFollowing ? prev + 1 : prev - 1);
    }
  };

  if (isDataLoading && !userData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!userData && !isDataLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <UserIcon className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">사용자를 찾을 수 없습니다</h2>
        <Button onClick={() => navigate(-1)} variant="outline">뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <div className="pt-[88px]">
        <div className="px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="text-lg font-black text-gray-900">{userData?.nickname || '탐험가'}</h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={userData?.avatar_url || FALLBACK_IMAGE} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{userData?.nickname || '탐험가'}</h2>
              <p className="text-sm text-gray-500 mb-4">{userData?.bio || "지도를 여행하는 탐험가 📍"}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{userPosts.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{followerCount}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                </div>
                <div className="text-center">
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
            <Button variant="outline" onClick={() => navigate(`/chat/${userId}`)} className="flex-1 rounded-xl font-bold h-11 border-gray-200">
              <MessageCircle className="w-4 h-4 mr-2" /> 메시지
            </Button>
          </div>

          <div className="flex border-b border-gray-100 mb-4">
            <button onClick={() => setViewMode('grid')} className={cn("flex-1 py-3 flex justify-center", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Grid className="w-6 h-6" /></button>
            <button onClick={() => setViewMode('gifs')} className={cn("flex-1 py-3 flex justify-center", (viewMode === 'gifs' || viewMode === 'gif-list') ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Play className="w-6 h-6" /></button>
            <button onClick={() => setViewMode('saved')} className={cn("flex-1 py-3 flex justify-center", viewMode === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Bookmark className="w-6 h-6" /></button>
          </div>

          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <div className="px-6 flex flex-col gap-6">
                {savedPosts.map((post) => (
                  <PostItem key={post.id} post={post} />
                ))}
              </div>
            ) : (
              (viewMode === 'list' || viewMode === 'gif-list') ? (
                <div className="px-6 flex flex-col gap-6">
                  {userPosts.map((post) => (
                    <PostItem key={post.id} post={post} onLikeToggle={() => handleLikeToggle(post.id)} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 px-6">
                  {userPosts.map((post) => (
                    <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden" onClick={() => setViewMode('list')}>
                      <img src={post.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;