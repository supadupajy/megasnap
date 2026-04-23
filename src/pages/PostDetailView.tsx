"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import { remapUnsplashDisplayUrl } from '@/lib/mock-data';

const PostDetailView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;
      
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (error) throw error;
        if (data) {
          const formattedPost = await mapDbToPost(data);
          setPost(formattedPost);
        }
      } catch (err) {
        console.error("Error fetching post:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const mapDbToPost = async (p: any): Promise<Post> => {
    const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";
    const sanitized = await sanitizeYoutubeMedia(p);
    
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

    let finalImage = sanitized.image_url || SAFE_FALLBACK;
    if (finalImage.includes('unsplash.com')) {
      finalImage = remapUnsplashDisplayUrl(finalImage, sanitized.id, sanitized.category || 'general') || finalImage;
    }

    return {
      id: sanitized.id,
      isAd: false,
      isGif: false,
      isInfluencer: false,
      user: { 
        id: sanitized.user_id, 
        name: sanitized.user_name || '탐험가', 
        avatar: sanitized.user_avatar || `https://i.pravatar.cc/150?u=${sanitized.user_id}` 
      },
      content: sanitized.content || '',
      location: sanitized.location_name || '알 수 없는 장소',
      lat: sanitized.latitude,
      lng: sanitized.longitude,
      likes: Number(sanitized.likes || 0),
      commentsCount: 0,
      comments: [], 
      image: finalImage,
      images: sanitized.images || [finalImage],
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

  if (!post) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-gray-500 mb-4">포스팅을 찾을 수 없습니다.</p>
        <Button onClick={() => navigate(-1)}>뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="fixed top-0 left-0 right-0 h-[88px] bg-white z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h2 className="ml-2 text-lg font-black text-gray-900">포스팅</h2>
      </div>
      
      <div className="pt-[88px]">
        <PostItem 
          post={post} 
          onLocationClick={(e, lat, lng) => {
            e.stopPropagation();
            navigate('/', { state: { center: { lat, lng }, zoom: 16, post } });
          }}
        />
      </div>
    </div>
  );
};

export default PostDetailView;