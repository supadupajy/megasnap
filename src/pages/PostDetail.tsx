"use client";

import React, { useState, useEffect } from 'react';
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
  const { user: authUser } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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

    const finalImages = rawImages.filter(isValidUrl);
    
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
      images: finalImages,
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
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* 1. 상단 헤더 공간 (88px) - 투명하게 설정하여 뒤의 HeaderAdBanner가 보이도록 함 */}
      <div className="h-[88px] w-full shrink-0 z-50 pointer-events-none" />

      {/* 2. 고정 영역: 페이지 타이틀 - 스크롤해도 고정됨 */}
      <div className="shrink-0 bg-white z-40 border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">내 포스팅</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">MY POSTS</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* 3. 실제 스크롤이 일어나는 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-white overscroll-contain">
        <div className="pb-28">
          {allPosts.map((p) => (
            <div key={p.id} id={`post-${p.id}`}>
              <PostItem 
                post={p} 
                disablePulse={true}
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