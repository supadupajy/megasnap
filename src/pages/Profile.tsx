"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Settings, 
  Grid, 
  Map as MapIcon, 
  LogOut, 
  ChevronLeft, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Navigation, 
  Map,
  Loader2,
  User as UserIcon,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import PostItem from '@/components/PostItem';
import ProfileEditDrawer from '@/components/ProfileEditDrawer';
import { Post, Comment as PostComment } from '@/types';
import { cn, getYoutubeThumbnail, getFallbackImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { showSuccess, showError } from '@/utils/toast';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (profileError) throw profileError;
        
        setProfile(profileData);
        
        // Fetch posts
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (postError) throw postError;
        
        setPosts(postData);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [user]);

  const mapDbToPost = async (p: any): Promise<Post> => {
    const SAFE_FALLBACK = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";

    const isValidUrl = (url: any) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      // [FIX] 'Content 0'과 같은 잘못된 플레이스홀더 텍스트나 비정상적인 URL 필터링
      if (/content\s*\d+/i.test(clean)) return false;
      if (/post\s*content/i.test(clean)) return false;
      if (!clean.startsWith('http')) return false;
      return true;
    };

    // 데이터 클렌징: 이미지가 유효하지 않으면 폴백 이미지 사용
    let rawImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    let rawImages = Array.isArray(p.images) && p.images.length > 0 
      ? p.images.filter(isValidUrl)
      : [];
      
    if (rawImages.length === 0) rawImages = [rawImage];

    // 정제된 데이터를 바탕으로 sanitize 진행
    const sanitized = await sanitizeYoutubeMedia({ ...p, image_url: rawImage, images: rawImages });
    const isAd = sanitized.content?.trim().startsWith('[AD]');
    
    let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';
    const likesCountNum = Number(sanitized.likes || 0);
    
    // [FIX] 인기 포스팅 기준을 좋아요 9,000개 이상으로 설정
    if (likesCountNum >= 9000) {
      borderType = 'popular';
    } else if (!isAd) {
      borderType = getTierFromId(sanitized.id);
    }
    
    let finalImage = isValidUrl(sanitized.image_url) ? sanitized.image_url : SAFE_FALLBACK;
    
    if (finalImage.includes('unsplash.com')) {
      finalImage = remapUnsplashDisplayUrl(finalImage, sanitized.id, isAd ? 'food' : (sanitized.category || 'general')) || finalImage;
    }
    
    let finalImages = Array.isArray(sanitized.images) && sanitized.images.length > 0 
      ? sanitized.images.filter(isValidUrl)
      : [finalImage];

    let isLiked = false;
    let isSaved = false;
    
    if (user?.id) {
      const [{ data: likeData }, { data: saveData }] = await Promise.all([
        supabase.from('likes').select('id').eq('post_id', sanitized.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('saved_posts').select('id').eq('post_id', sanitized.id).eq('user_id', user.id).maybeSingle()
      ]);
      isLiked = !!likeData;
      isSaved = !!saveData;
    }

    return {
      id: sanitized.id, isAd, isGif: false, isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user: { 
        id: sanitized.user_id, 
        name: sanitized.user_id === user?.id ? profile?.nickname || user.email?.split('@')[0] || '탐험가' : (sanitized.user_name || '탐험가'), 
        avatar: sanitized.user_id === user?.id ? (profile?.avatar_url || `https://i.pravatar.cc/150?u=${user.id}`) : (sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}`)
      },
      content: sanitized.content?.replace(/^\[AD\]\s*/, '') || '', 
      location: sanitized.location_name || '알 수 없는 장소', 
      lat: sanitized.latitude, 
      lng: sanitized.longitude,
      likes: Number(sanitized.likes || 0), 
      commentsCount: 0, 
      comments: [], 
      image: finalImage, 
      image_url: finalImage, // 명시적 추가
      images: finalImages.length > 0 ? finalImages : [finalImage], 
      youtubeUrl: sanitized.youtube_url, 
      videoUrl: sanitized.video_url,
      isLiked, 
      isSaved, 
      createdAt: new Date(sanitized.created_at), 
      borderType,
      category: sanitized.category || 'none'
    };
  };

  const handleLikeToggle = useCallback((postId: string, isFromSaved: boolean) => {
    const updatePost = (prev: Post[]) => prev.map(post => 
      post.id === postId ? { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 } : post
    );
    setPosts(updatePost);
  }, []);

  const handleSaveToggle = useCallback((postId: string, isSaved: boolean) => {
    if (isSaved) {
      // If we're removing from saved, filter it out of savedPosts but keep in myPosts (if it's mine)
      setPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      // If we're adding to saved, we need to re-fetch or find the post
      // For simplicity in this case, we refresh the data
      if (user?.id) {
        setLoading(true);
        // Refresh data
      }
    }
  }, [user?.id]);

  const handleGridItemClick = (postId: string) => {
    setViewMode('list');
    setTimeout(() => { const element = document.getElementById(`post-${postId}`); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleImageError = useCallback((postId: string) => { setPosts(prev => prev.filter(p => p.id !== postId)); }, []);
  const handlePostDelete = useCallback(async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      showSuccess('게시물이 삭제되었습니다.');
    } catch (err) {
      console.error('[Profile] Delete error:', err);
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  }, []);
  
  const handleLocationClick = useCallback((e: React.MouseEvent, lat: number, lng: number, post: Post) => {
    e.stopPropagation();
    navigate('/', { 
      state: { 
        post,
        center: { lat, lng },
        zoom: 16
      } 
    });
  }, [navigate]);

  const handleViewOnMap = () => { const latestPost = posts[0]; navigate('/', { state: { filterUserId: 'me', post: latestPost, center: latestPost ? { lat: latestPost.lat, lng: latestPost.lng } : undefined } }); };

  const handleScrollToPosts = () => {
    if (scrollRef.current && postListStartRef.current) {
      const postListTop = postListStartRef.current.offsetTop;
      const headerHeight = 88; 
      const targetScroll = postListTop - headerHeight;

      scrollRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
          {/* 안드로이드 상단 상태바 여백 */}
          <div className="h-[env(safe-area-inset-top,0px)] w-full" />
          
          <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none">내 프로필</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">My Activity & Records</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="ml-4 text-gray-400 font-medium">프로필 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        {/* 안드로이드 상단 상태바 여백 */}
        <div className="h-[env(safe-area-inset-top,0px)] w-full" />
        
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none">내 프로필</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">My Activity & Records</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-6 mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900 mb-1">{profile?.nickname || user?.email?.split('@')[0] || '탐험가'}</h2>
            <p className="text-sm text-gray-500 mb-4">{profile?.bio || "지도를 여행하는 탐험가 📍"}</p>
            <div className="flex gap-4">
              <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={handleScrollToPosts}>
                <p className="font-bold text-gray-900">{posts.length}</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
              </div>
              <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${user?.id}`, { state: { tab: 'followers' } })}>
                <p className="font-bold text-gray-900">0</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
              </div>
              <div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${user?.id}`, { state: { tab: 'following' } })}>
                <p className="font-bold text-gray-900">0</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={() => setIsEditOpen(true)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl mb-8">프로필 편집</Button>

        <div ref={postListStartRef} className="flex border-b border-gray-100 mb-4">
          <button 
            onClick={() => setViewMode('grid')} 
            className={cn("flex-1 py-3 flex justify-center transition-all", (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600" : "text-gray-300")}
          >
            <Grid className={cn("w-6 h-6", (viewMode === 'grid' || viewMode === 'list') ? "text-indigo-600" : "")} />
          </button>
          <button 
            onClick={() => setViewMode('saved')} 
            className={cn("flex-1 py-3 flex justify-center transition-all", viewMode === 'saved' ? "border-b-2 border-indigo-600" : "text-gray-300")}
          >
            <Bookmark className={cn("w-6 h-6", viewMode === 'saved' ? "text-indigo-600" : "")} />
          </button>
        </div>

        <div className="flex flex-col -mx-6">
          {viewMode === 'saved' ? (
            <div className="flex flex-col">
              {savedPosts.map((post) => (
                <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                  <PostItem 
                    post={post} 
                    disablePulse={true} 
                    onLikeToggle={() => handleLikeToggle(post.id, true)} 
                    onSaveToggle={() => handleSaveToggle(post.id, post.isSaved || false)} 
                    onLocationClick={(e, lat, lng) => handleLocationClick(e, lat, lng, post)}
                  />
                </div>
              ))}
              {savedPosts.length === 0 && !isDataLoading && (
                <div className="py-20 text-center text-gray-400 font-medium">저장된 포스팅이 없습니다.</div>
              )}
            </div>
          ) : (
            <>
              <div onClick={handleViewOnMap} className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors">
                <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                  <Map className="w-4 h-4 fill-indigo-600" />지도에서 보기
                </h3>
                <p className="text-[10px] text-indigo-400 font-bold mt-0.5">나의 추억들을 지도에서 확인하세요</p>
              </div>
              {(viewMode === 'list') ? (
                <div className="flex flex-col">
                  {myPosts.map((post) => (
                    <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                      <PostItem 
                        post={post} 
                        disablePulse={true} 
                        onLikeToggle={() => handleLikeToggle(post.id, false)} 
                        onSaveToggle={() => handleSaveToggle(post.id, post.isSaved || false)} 
                        onLocationClick={(e, lat, lng) => handleLocationClick(e, lat, lng, post)} 
                        onDelete={() => handlePostDelete(post.id)} 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 px-6">
                  {myPosts.map((post) => (
                    <div
                      key={post.id}
                      className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group cursor-pointer"
                      onClick={() => navigate(`/post/${post.id}`)}
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
                          onError={() => handleImageError(post.id)}
                        />
                      )}
                      {(post.videoUrl || post.youtubeUrl) && (
                        <div className="absolute top-2 right-2 z-10">
                          <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
                        </div>
                      )}
                    </div>
                  ))}
                  {myPosts.length === 0 && !isDataLoading && (
                    <div className="col-span-3 py-20 text-center text-gray-400 font-medium">아직 등록된 포스팅이 없습니다.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;