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
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const { profile, user: authUser, loading: authLoading, refreshProfile } = useAuth();
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'saved' | 'list'>('grid');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const hasFetched = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null); // 스크롤 컨테이너 Ref
  const postListStartRef = useRef<HTMLDivElement>(null); // 포스팅 리스트 시작점 Ref

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

  const mapDbToPost = async (p: any, isLiked = false, isSaved = false): Promise<Post> => {
    const SAFE_FALLBACK = "https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg";

    const isValidUrl = (url: any) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      if (/content\s*\d+/i.test(clean)) return false;
      if (/post\s*content/i.test(clean)) return false;
      if (!clean.startsWith('http')) return false;
      return true;
    };

    let rawImage = isValidUrl(p.image_url) ? p.image_url : SAFE_FALLBACK;
    let rawImages = Array.isArray(p.images) && p.images.length > 0 
      ? p.images.filter(isValidUrl)
      : [];
      
    if (rawImages.length === 0) rawImages = [rawImage];

    const sanitized = await sanitizeYoutubeMedia({ ...p, image_url: rawImage, images: rawImages });
    const isAd = sanitized.content?.trim().startsWith('[AD]');
    
    let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';
    const likesCountNum = Number(sanitized.likes || 0);
    
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

    return {
      id: sanitized.id, isAd, isGif: false, isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
      user: { 
        id: sanitized.user_id, 
        name: sanitized.user_id === authUser?.id ? displayName : (sanitized.user_name || '탐험가'), 
        avatar: sanitized.user_id === authUser?.id ? avatarUrl : (sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}`)
      },
      content: sanitized.content?.replace(/^\[AD\]\s*/, '') || '',
      location: sanitized.location_name || '알 수 없는 장소',
      lat: sanitized.latitude,
      lng: sanitized.longitude,
      latitude: sanitized.latitude,
      longitude: sanitized.longitude,
      likes: Number(sanitized.likes || 0),
      commentsCount: 0, 
      comments: [], 
      image: finalImage, 
      image_url: finalImage,
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

  const loadProfileData = useCallback(async (uid: string) => {
    setIsDataLoading(true);
    try {
      // 1. Fetch My Posts
      const { data: myData, error: myPostsError } = await supabase
        .from('posts')
        .select('id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);

      if (myPostsError) {
        console.error('[Profile] My Posts fetch error:', myPostsError);
      }

      // 2. Fetch Saved Posts
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select(`
          post_id,
          posts (id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id)
        `)
        .eq('user_id', uid)
        .limit(20);

      if (savedError) {
        console.error('[Profile] Saved Posts fetch error:', savedError);
      }

      // 3. 일괄로 likes/saved 상태 조회 (N+1 쿼리 제거)
      const myPostIds = (myData || []).map(p => p.id);
      const savedPostObjects = (savedData || []).filter((item: any) => item.posts).map((item: any) => item.posts);
      const savedPostIds = savedPostObjects.map((p: any) => p.id);
      const allPostIds = [...new Set([...myPostIds, ...savedPostIds])];

      let likedPostIds = new Set<string>();
      // [Optimized] savedPostIdSet은 이미 위 savedData에서 알 수 있음 → 중복 조회 제거
      // 단, 내 포스트 중에 내가 저장한 것은 아직 모르므로, my posts 중 savedPostIds에 포함된 것만 체크
      const savedPostIdSet = new Set<string>(savedPostIds);

      if (authUser?.id && allPostIds.length > 0) {
        // saved_posts 중복 쿼리 제거 → likes 1번만
        const { data: likesData } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', authUser.id)
          .in('post_id', allPostIds);
        likedPostIds = new Set((likesData || []).map(l => l.post_id));

        // my posts 중에 saved에 포함되지 않은 것들에 대해 saved 여부 추가 확인
        // (내 포스트를 내가 저장했는지 알기 위해)
        const myPostsNotInSaved = myPostIds.filter(id => !savedPostIdSet.has(id));
        if (myPostsNotInSaved.length > 0) {
          const { data: extraSavedData } = await supabase
            .from('saved_posts')
            .select('post_id')
            .eq('user_id', authUser.id)
            .in('post_id', myPostsNotInSaved);
          (extraSavedData || []).forEach(s => savedPostIdSet.add(s.post_id));
        }
      }

      if (myData) {
        const formattedMyPosts = await Promise.all(
          myData.map(p => mapDbToPost(p, likedPostIds.has(p.id), savedPostIdSet.has(p.id)))
        );
        setMyPosts(formattedMyPosts);
      }

      if (savedPostObjects.length > 0) {
        const formattedSavedPosts = await Promise.all(
          savedPostObjects.map((p: any) => mapDbToPost(p, likedPostIds.has(p.id), savedPostIdSet.has(p.id)))
        );
        setSavedPosts(formattedSavedPosts);
      }
      
      // [Optimized] count: 'exact' → 'planned' (RLS 적용 테이블에서 훨씬 빠름)
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'planned', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'planned', head: true }).eq('follower_id', uid)
      ]);
      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
    } catch (err) { hasFetched.current = false; } finally { setIsDataLoading(false); }
  }, []);

  useEffect(() => { 
    if (!authLoading && authUser?.id) {
      // ✅ 페이지가 마운트되거나 auth 상태가 변경될 때 즉시 데이터 로드
      loadProfileData(authUser.id); 
    } 
  }, [authLoading, authUser?.id, loadProfileData]);

  const handleLikeToggle = useCallback((postId: string, isFromSaved: boolean) => {
    const updatePost = (prev: Post[]) => prev.map(post => 
      post.id === postId ? { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 } : post
    );
    setMyPosts(updatePost);
    setSavedPosts(updatePost);
  }, []);

  const handleSaveToggle = useCallback((postId: string, isSaved: boolean) => {
    if (isSaved) {
      // If we're removing from saved, filter it out of savedPosts but keep in myPosts (if it's mine)
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
      setMyPosts(prev => prev.map(p => p.id === postId ? { ...p, isSaved: false } : p));
    } else {
      // If we're adding to saved, we need to re-fetch or find the post
      // For simplicity in this case, we refresh the data
      if (authUser?.id) {
        hasFetched.current = false;
        loadProfileData(authUser.id);
      }
    }
  }, [authUser?.id, loadProfileData]);

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

  const handleImageError = useCallback((postId: string) => { setMyPosts(prev => prev.filter(p => p.id !== postId)); setSavedPosts(prev => prev.filter(p => p.id !== postId)); }, []);
  const handlePostDelete = useCallback(async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

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
    navigate('/', { 
      state: { 
        post,
        center: { lat, lng },
        zoom: 16
      } 
    });
  }, [navigate]);

  const handleViewOnMap = () => { const latestPost = myPosts[0]; navigate('/', { state: { filterUserId: 'me', post: latestPost, center: latestPost ? { lat: latestPost.lat, lng: latestPost.lng } : undefined } }); };

  const handleScrollToPosts = () => {
    if (scrollRef.current && postListStartRef.current) {
      const postListTop = postListStartRef.current.offsetTop;
      const headerHeight = 100; // 헤더 높이가 커졌으므로 조정
      const targetScroll = postListTop - headerHeight;

      scrollRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  if (authLoading || (authUser && isDataLoading && myPosts.length === 0 && savedPosts.length === 0)) {
    return (<div className="min-h-screen bg-white flex items-center justify-center"><div className="flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /><p className="text-xs font-bold text-gray-400">프로필을 불러오는 중...</p></div></div>);
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* 내 프로필 상단 메뉴 바 - 앱 헤더(64px) 바로 아래에 고정 */}
      <div className="fixed left-0 right-0 z-40 px-4 py-4 bg-white border-b border-gray-100 flex items-center" style={{ top: '64px' }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm">
              <UserIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">내 프로필</h2>
              <p className="text-[10px] text-gray-400 font-medium leading-none uppercase tracking-widest">My Activity</p>
            </div>
          </div>
          <div className="p-2 bg-white rounded-full shadow-sm border border-gray-100 cursor-pointer" onClick={() => navigate('/settings')}>
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* 앱 헤더(64px) + 프로필 타이틀바(~64px) 높이만큼 상단 여백 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white pb-28 no-scrollbar pt-[136px]">
        <div className="p-6">
          <div className="flex items-center gap-6 mb-8"><div className="relative"><div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600"><img src={avatarUrl} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} /></div></div><div className="flex-1"><h2 className="text-xl font-black text-gray-900 mb-1">{displayName}</h2><p className="text-sm text-gray-500 mb-4">{profile?.bio || "지도를 여행하는 탐험가 📍"}</p><div className="flex gap-4"><div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={handleScrollToPosts}><p className="font-bold text-gray-900">{myPosts.length}</p><p className="text-[10px] text-gray-400 uppercase font-black">Posts</p></div><div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'followers' } })}><p className="font-bold text-gray-900">{followerCount.toLocaleString()}</p><p className="text-[10px] text-gray-400 uppercase font-black">Followers</p></div><div className="text-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/follow/${userId}`, { state: { tab: 'following' } })}><p className="font-bold text-gray-900">{followingCount.toLocaleString()}</p><p className="text-[10px] text-gray-400 uppercase font-black">Following</p></div></div></div></div>
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
      </div>
      <ProfileEditDrawer isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onUpdate={refreshProfile} />
    </div>
  );
};

export default Profile;