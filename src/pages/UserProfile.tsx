"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Grid, Bookmark, ChevronLeft, UserPlus, Check, MessageCircle, MoreVertical, Play, AlertCircle, Ban, Map, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import WritePost from '@/components/WritePost';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';
import { chatStore } from '@/utils/chat-store';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';
import { useAuth } from '@/components/AuthProvider';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: authUser } = useAuth();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'gifs' | 'list' | 'gif-list' | 'saved'>('grid');
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [targetUser, setTargetUser] = useState<any>(null); // 실제 DB에서 가져온 유저 정보

  // 전역 글쓰기 이벤트 리스너
  useEffect(() => {
    const handleOpenWrite = () => setIsWriteOpen(true);
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
  }, []);

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
      createdAt: new Date(sanitized.created_at),
      borderType,
      category: sanitized.category || 'none',
    };
  };

  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // 1. 타겟 유저 프로필 정보 가져오기
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) throw new Error('User not found');
      setTargetUser(profileData);

      // 2. 유저 게시물 가져오기
      const { data, error } = await supabase
        .from('posts')
        .select('*, category')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const formatted = await Promise.all((data || []).map(mapDbToPost));
      setPosts(formatted);

      // 3. 팔로워/팔로잉 카운트 가져오기
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
      ]);

      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);

      // 4. 팔로우 상태 확인
      if (authUser) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', authUser.id)
          .eq('following_id', userId)
          .maybeSingle();
        
        setIsFollowing(!!followData);
      }

    } catch (err) {
      console.error('Error fetching user data:', err);
      setTargetUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, authUser]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleFollowToggle = async () => {
    if (!authUser || !userId) {
      showError('로그인이 필요합니다.');
      return;
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', userId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => prev - 1);
        showSuccess('팔로우를 취소했습니다.');
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: authUser.id,
            following_id: userId
          });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        showSuccess('팔로우를 시작했습니다! ✨');
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      showError('처리에 실패했습니다.');
    }
  };

  const handleLikeToggle = useCallback((postId: string, isFromSaved: boolean) => {
    const setter = isFromSaved ? setSavedPosts : setPosts;
    setter(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likes: isLiked ? post.likes + 1 : post.likes - 1
        };
      }
      return post;
    }));
  }, []);

  const handleGridItemClick = (postId: string) => {
    if (viewMode === 'gifs') {
      setViewMode('gif-list');
    } else {
      setViewMode('list');
    }
    
    setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = FALLBACK_IMAGE;
  };

  const handleMessageClick = () => {
    if (!targetUser) return;
    chatStore.getOrCreateRoom(targetUser.id, targetUser.nickname || targetUser.name, targetUser.avatar_url);
    navigate(`/chat/${targetUser.id}`);
  };

  const handleReport = () => {
    showSuccess('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
  };

  const handleBlock = () => {
    if (!targetUser) return;
    showError(`${targetUser.nickname} 님을 차단했습니다.`);
  };

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
        <div className="pt-[88px] p-6 text-center">
          <h2 className="text-xl font-black text-gray-900 mb-4">사용자를 찾을 수 없습니다.</h2>
          <Button onClick={() => navigate(-1)}>뒤로가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <div className="pt-[88px]">
        <div className="px-4 py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-90 transition-all"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h2 className="text-xl font-black text-gray-900">유저 프로필</h2>
                <p className="text-xs text-gray-400 font-medium">@{targetUser.nickname} 님의 활동</p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors outline-none">
                  <MoreVertical className="w-6 h-6 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">
                <DropdownMenuItem 
                  onClick={handleReport}
                  className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"
                >
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-bold text-gray-700">신고</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleBlock}
                  className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
                >
                  <Ban className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-bold text-red-600">차단</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-400 to-indigo-600">
                <img 
                  src={targetUser.avatar_url || `https://i.pravatar.cc/150?u=${targetUser.id}`} 
                  alt="profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-white"
                  onError={handleImageError}
                />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{targetUser.nickname}</h2>
              <p className="text-sm text-gray-500 mb-4">{targetUser.bio || 'Chora 탐험가'}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{posts.length}</p>
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

          <div className="flex gap-2 mb-8">
            <Button 
              onClick={handleFollowToggle}
              className={`flex-1 font-bold rounded-xl gap-2 h-12 transition-all ${
                isFollowing 
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isFollowing ? (
                <>
                  <Check className="w-4 h-4" /> 팔로잉
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> 팔로우
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleMessageClick}
              className="flex-1 border-gray-200 text-gray-900 font-bold rounded-xl gap-2 h-12"
            >
              <MessageCircle className="w-4 h-4" /> 메시지
            </Button>
          </div>

          <div className="flex border-b border-gray-100 mb-4">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                (viewMode === 'grid' || viewMode === 'list') ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Grid className={cn("w-6 h-6", (viewMode === 'grid' || viewMode === 'list') ? "text-indigo-600" : "")} />
            </button>
            <button 
              onClick={() => setViewMode('gifs')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                (viewMode === 'gifs' || viewMode === 'gif-list') ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Play className={cn("w-6 h-6", (viewMode === 'gifs' || viewMode === 'gif-list') ? "text-indigo-600" : "")} />
            </button>
            <button 
              onClick={() => setViewMode('saved')}
              className={cn(
                "flex-1 py-3 flex justify-center transition-all",
                viewMode === 'saved' ? "border-b-2 border-indigo-600" : "text-gray-300"
              )}
            >
              <Bookmark className={cn("w-6 h-6", viewMode === 'saved' ? "text-indigo-600" : "")} />
            </button>
          </div>

          <div className="flex flex-col -mx-6">
            {viewMode === 'saved' ? (
              <>
                <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4">
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                    <Bookmark className="w-4 h-4 fill-indigo-600" />
                    저장된 포스팅
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">다른 탐험가들의 멋진 기록들</p>
                </div>
                {savedPosts.map((post) => (
                  <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                    <PostItem
                      id={post.id}
                      user={post.user}
                      content={post.content}
                      location={post.location}
                      likes={post.likes}
                      commentsCount={post.commentsCount}
                      comments={post.comments}
                      image={post.image}
                      images={post.images}
                      isLiked={post.isLiked}
                      isAd={post.isAd}
                      isGif={post.isGif}
                      isInfluencer={post.isInfluencer}
                      borderType={post.borderType}
                      disablePulse={true}
                      onLikeToggle={() => handleLikeToggle(post.id, true)}
                    />
                  </div>
                ))}
                {savedPosts.length === 0 && !isLoading && (
                  <div className="py-20 text-center text-gray-400 font-medium">저장된 포스팅이 없습니다.</div>
                )}
              </>
            ) : (
              <>
                <div 
                  onClick={() => navigate('/', { state: { filterUserId: userId } })}
                  className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors"
                >
                  <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                    <Map className="w-4 h-4 fill-indigo-600" />
                    지도에서 보기
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">{targetUser.nickname} 님의 추억들을 지도에서 확인하세요</p>
                </div>

                {(viewMode === 'list' || viewMode === 'gif-list') ? (
                  <div className="flex flex-col">
                    {(viewMode === 'gif-list' ? posts.filter(p => p.isGif) : posts).map((post) => (
                      <div key={post.id} id={`post-${post.id}`} className="scroll-mt-[150px]">
                        <PostItem
                          id={post.id}
                          user={post.user}
                          content={post.content}
                          location={post.location}
                          likes={post.likes}
                          commentsCount={post.commentsCount}
                          comments={post.comments}
                          image={post.image}
                          images={post.images}
                          isLiked={post.isLiked}
                          isAd={post.isAd}
                          isGif={post.isGif}
                          isInfluencer={post.isInfluencer}
                          borderType={post.borderType}
                          disablePulse={true}
                          onLikeToggle={() => handleLikeToggle(post.id, false)}
                          onDelete={handlePostDelete}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 px-6">
                    {(viewMode === 'gifs' ? posts.filter(p => p.isGif) : posts).map((post) => (
                      <div 
                        key={post.id} 
                        className="aspect-square bg-gray-100 overflow-hidden rounded-sm relative group"
                        onClick={() => handleGridItemClick(post.id)}
                      >
                        <img src={post.image} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" onError={handleImageError} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default UserProfile;