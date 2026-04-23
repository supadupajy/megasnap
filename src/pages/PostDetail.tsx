"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = authUser?.id;
  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`, [profile, userId]);

  useEffect(() => {
    const fetchAllPosts = async () => {
      if (!authUser?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) {
          const formattedPosts = await Promise.all(data.map(mapDbToPost));
          setAllPosts(formattedPosts);
        }
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, [authUser?.id, id]);

  useEffect(() => {
    if (id && allPosts.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`post-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 100);
    }
  }, [id, allPosts]);

  const handleLikeToggle = (postId: string) => {
    setAllPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 } : post
    ));
  };

  const handlePostDelete = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setAllPosts(prev => prev.filter(p => p.id !== postId));
      showSuccess('게시물이 삭제되었습니다.');
      
      // 만약 현재 리스트에 포스팅이 더 이상 없다면 이전 화면으로 이동
      if (allPosts.length <= 1) {
        navigate(-1);
      }
    } catch (err) {
      console.error('[PostDetail] Delete error:', err);
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  };

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
    if (finalImage.includes('unsplash.com')) {
      finalImage = remapUnsplashDisplayUrl(finalImage, sanitized.id, isAd ? 'food' : (sanitized.category || 'general')) || finalImage;
    }

    // [FIX] sanitized.images가 없거나 단일 URL인 경우를 대비하여 rawImages 필터링 결과 활용
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
      id: sanitized.id,
      isAd,
      isGif: false,
      isInfluencer: false,
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
      images: finalImages, // [FIX] 정제된 finalImages 사용
      youtubeUrl: sanitized.youtube_url,
      videoUrl: sanitized.video_url,
      isLiked,
      isSaved,
      createdAt: new Date(sanitized.created_at),
      category: sanitized.category || 'none'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 font-bold mb-4">게시물을 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)} className="text-indigo-600 font-black">뒤로 가기</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Header Space for Banner */}
      <div className="h-[88px] w-full shrink-0 z-50 pointer-events-none" />

      {/* Fixed Title Header - Now outside of scrollable main */}
      <div className="shrink-0 bg-white z-40 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">내 포스팅</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">MY POSTS</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-white">
        <div className="pb-28">
          {allPosts.map((p) => (
            <div key={p.id} id={`post-${p.id}`}>
              <PostItem 
                post={p} 
                disablePulse={true}
                autoPlayVideo={true}
                onLikeToggle={() => handleLikeToggle(p.id)}
                onDelete={() => handlePostDelete(p.id)}
                onLocationClick={(e, lat, lng) => navigate('/', { state: { center: { lat, lng }, zoom: 16, post: p } })}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PostDetail;