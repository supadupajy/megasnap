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
import { showSuccess, showError } from '@/utils/toast';

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
      console.log("[PostDetail] fetchAllPosts started. ID:", id, "AuthUser:", authUser?.id);
      
      if (!authUser?.id) {
        console.log("[PostDetail] No authUser.id yet.");
        return;
      }
      
      setLoading(true);
      try {
        if (id) {
          console.log("[PostDetail] Fetching target post info for ID:", id);
          const { data: targetPost, error: targetError } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
            
          if (targetError) {
            console.error("[PostDetail] Error fetching target post:", targetError);
          }

          if (targetPost) {
            console.log("[PostDetail] Found target post owner:", targetPost.user_id);
            const { data, error } = await supabase
              .from('posts')
              .select('*')
              .eq('user_id', targetPost.user_id)
              .order('created_at', { ascending: false });

            if (error) {
              console.error("[PostDetail] Error fetching owner posts:", error);
            } else if (data) {
              console.log("[PostDetail] Found owner posts count:", data.length);
              const formattedPosts = await Promise.all(data.map(mapDbToPost));
              setAllPosts(formattedPosts);
              setLoading(false);
              return;
            }
          } else {
            console.warn("[PostDetail] Target post not found in DB for ID:", id);
          }
        }

        console.log("[PostDetail] Falling back to current user posts for ID:", authUser.id);
        const { data: myData, error: myError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (myError) throw myError;
        if (myData) {
          console.log("[PostDetail] Found current user posts count:", myData.length);
          const formattedPosts = await Promise.all(myData.map(mapDbToPost));
          setAllPosts(formattedPosts);
        }
      } catch (err) {
        console.error('[PostDetail] Error in fetchAllPosts:', err);
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
  <div className="min-h-screen bg-white" style={{ paddingTop: '88px' }}>
    {/* Header */}
    <div className="sticky top-[88px] z-40 bg-white flex items-center px-4 h-14 border-b border-gray-50">
      <button
        onClick={() => navigate(-1)}
        className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <h2 className="text-lg font-black text-gray-900 tracking-tight">내 포스팅</h2>
      </div>
    </div>

    {/* Scrollable Content Area */}
    <main className="pb-28">
      {allPosts.map((p) => (
        <div key={p.id} id={`post-${p.id}`} className="scroll-mt-[144px]">
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
    </main>
  </div>
);
};

export default PostDetail;