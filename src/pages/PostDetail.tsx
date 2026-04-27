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

const POST_COLUMNS = 'id, content, image_url, images, location_name, latitude, longitude, likes, category, youtube_url, video_url, created_at, user_id, user_name, user_avatar';

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = authUser?.id;
  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || `https://i.pravatar.cc/150?u=${userId}`, [profile, userId]);

  const isValidUrl = (url: any) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (/post\s*content/i.test(clean)) return false;
    if (!clean.startsWith('http')) return false;
    return true;
  };

  const mapDbToPost = async (
    p: any,
    likedSet: Set<string>,
    savedSet: Set<string>
  ): Promise<Post> => {
    const SAFE_FALLBACK = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80";

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

    let finalImages = Array.isArray(sanitized.images) && sanitized.images.length > 0
      ? sanitized.images.filter(isValidUrl)
      : [finalImage];

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
      latitude: sanitized.latitude,
      longitude: sanitized.longitude,
      likes: Number(sanitized.likes || 0),
      commentsCount: 0,
      comments: [],
      image: finalImage,
      image_url: finalImage,
      images: finalImages,
      youtubeUrl: sanitized.youtube_url,
      videoUrl: sanitized.video_url,
      isLiked: likedSet.has(sanitized.id),
      isSaved: savedSet.has(sanitized.id),
      createdAt: new Date(sanitized.created_at),
      category: sanitized.category || 'none'
    };
  };

  useEffect(() => {
    const fetchAllPosts = async () => {
      if (!authUser?.id || !id) return;

      setLoading(true);
      try {
        // [Optimized] 단일 쿼리로 target post 조회 (필요한 컬럼만)
        const { data: targetPost, error: targetError } = await supabase
          .from('posts')
          .select(POST_COLUMNS)
          .eq('id', id)
          .maybeSingle();

        if (targetError) {
          console.error("[PostDetail] Error fetching target post:", targetError);
        }

        let postsToFormat: any[] = [];

        if (targetPost) {
          // [Optimized] 클라이언트 필터링 제거 → 서버사이드 user_id 필터 사용
          // (idx_posts_user_id 인덱스가 있으므로 매우 빠름)
          const { data, error } = await supabase
            .from('posts')
            .select(POST_COLUMNS)
            .eq('user_id', targetPost.user_id)
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) {
            console.error("[PostDetail] Error fetching user's posts:", error);
            // Fallback: 단일 포스트만 표시
            postsToFormat = [targetPost];
          } else {
            postsToFormat = data || [targetPost];
          }
        }

        if (postsToFormat.length === 0) {
          setAllPosts([]);
          return;
        }

        // [Optimized] likes/saved_posts를 .in()으로 일괄 조회 (N+1 제거)
        const postIds = postsToFormat.map(p => p.id);
        let likedSet = new Set<string>();
        let savedSet = new Set<string>();

        if (authUser?.id && postIds.length > 0) {
          const [{ data: likesData }, { data: savedData }] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', postIds),
            supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).in('post_id', postIds)
          ]);
          likedSet = new Set((likesData || []).map(l => l.post_id));
          savedSet = new Set((savedData || []).map(s => s.post_id));
        }

        const formattedPosts = await Promise.all(
          postsToFormat.map(p => mapDbToPost(p, likedSet, savedSet))
        );
        setAllPosts(formattedPosts);
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

      if (allPosts.length <= 1) {
        navigate(-1);
      }
    } catch (err) {
      console.error('[PostDetail] Delete error:', err);
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
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
    <div className="min-h-screen bg-white">
      <div className="pt-16">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white flex items-center px-4 h-14 border-b border-gray-50">
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
    </div>
  );
};

export default PostDetail;
