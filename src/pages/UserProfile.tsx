"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Grid, 
  Map as MapIcon, 
  ChevronLeft, 
  User as UserIcon, 
  Loader2,
  Play,
  UserCheck,
  UserPlus,
  MessageCircle
} from 'lucide-react';
import { Post, User } from '@/types';
import { cn, getYoutubeThumbnail, getFallbackImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import PostItem from '@/components/PostItem';

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg';

const UserProfile = () => {
  const { userId: profileUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  const mapDbToPost = async (p: any): Promise<Post> => {
    const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";

    const isValidUrl = (url: any) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      if (/post\s*content/i.test(clean)) return false;
      if (!clean.startsWith('http')) return false;
      return true;
    };

    let rawImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    let rawImages = Array.isArray(p.images) && p.images.length > 0 
      ? p.images.filter(isValidUrl)
      : [rawImage];

    const sanitized = await sanitizeYoutubeMedia({ ...p, image_url: rawImage, images: rawImages });
    const isAd = sanitized.content?.trim().startsWith('[AD]');
    
    let finalImage = isValidUrl(sanitized.image_url) ? sanitized.image_url : SAFE_FALLBACK;
    
    let finalImages = Array.isArray(sanitized.images) && sanitized.images.length > 0 
      ? sanitized.images.filter(isValidUrl)
      : [finalImage];

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
      id: sanitized.id, isAd, isGif: false, isInfluencer: false,
      user: { id: sanitized.user_id, name: sanitized.user_name || '탐험가', avatar: sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}` },
      content: sanitized.content?.replace(/^\[AD\]\s*/, '') || '', location: sanitized.location_name || '알 수 없는 장소', lat: sanitized.latitude, lng: sanitized.longitude,
      likes: Number(sanitized.likes || 0), commentsCount: 0, comments: [], 
      image: finalImage, 
      images: finalImages, 
      youtubeUrl: sanitized.youtube_url, videoUrl: sanitized.video_url,
      isLiked, isSaved, createdAt: new Date(sanitized.created_at),
      category: sanitized.category || 'none'
    };
  };

  const toggleFollow = () => {
    setIsFollowing(!isFollowing);
    showSuccess(isFollowing ? '팔로우를 취소했습니다.' : '팔로우를 시작했습니다.');
  };

  const handleLikeToggle = (postId: string) => {
    setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const handleLocationClick = (e: React.MouseEvent, lat: number, lng: number) => {
    navigate('/', { state: { center: { lat, lng } } });
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profileUserId) return;
      try {
        setLoading(true);
        
        // Profiles 테이블에서 조회하도록 수정
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileUserId)
          .single();
        
        if (error) {
          console.error('Profile fetch error:', error);
          throw error;
        }
        
        setUserProfile(data);
        
        // 포스트 조회
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', profileUserId);
        
        if (postsError) throw postsError;
        
        const mappedPosts = await Promise.all((posts || []).map(mapDbToPost));
        setUserPosts(mappedPosts);
        
        // 팔로워/팔로잉 수 조회 (follows 테이블 기준)
        const [followersResult, followingResult] = await Promise.all([
          supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profileUserId),
          supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profileUserId)
        ]);
        
        setFollowerCount(followersResult.count || 0);
        setFollowingCount(followingResult.count || 0);
        
        // 현재 내가 팔로우 중인지 확인
        if (authUser?.id) {
          const { data: followCheck } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', authUser.id)
            .eq('following_id', profileUserId)
            .maybeSingle();
          setIsFollowing(!!followCheck);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [profileUserId, authUser?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
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
      <div className="pt-16">
        <div className="sticky top-0 z-40 bg-white flex items-center px-4 h-14 border-b border-gray-50">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">프로필</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={userProfile?.avatar_url || FALLBACK_IMAGE} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{userProfile?.nickname || '탐험가'}</h2>
              <p className="text-sm text-gray-500 mb-4">{userProfile?.bio || "지도를 여행하는 탐험가 📍"}</p>
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
            <Button variant="outline" onClick={() => navigate(`/chat/${profileUserId}`)} className="flex-1 rounded-xl font-bold h-11 border-gray-200">
              <MessageCircle className="w-4 h-4 mr-2" /> 메시지
            </Button>
          </div>

          <div className="flex border-b border-gray-100 mb-4">
            <div className="flex-1 py-3 flex justify-center border-b-2 border-indigo-600 text-indigo-600">
              <Grid className="w-6 h-6" />
            </div>
          </div>

          <div className="flex flex-col -mx-6">
            <div className="grid grid-cols-3 gap-1 px-6">
              {userPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <img 
                    src={post.image_url || post.image} 
                    alt="" 
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity" 
                    onError={() => {}} 
                  />
                </div>
              ))}
              {userPosts.length === 0 && <p className="text-center py-10 text-gray-400">게시물이 없습니다.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;