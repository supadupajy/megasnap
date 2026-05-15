"use client";

import React, { useState, useEffect, useMemo } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import PostItem from '@/components/PostItem';
import PostDeepLinkLanding from '@/components/PostDeepLinkLanding';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { toggleLikeInDb } from '@/utils/like-utils';

const POST_COLUMNS = 'id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar';

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = useMemo(() => profile?.nickname || authUser?.email?.split('@')[0] || '탐험가', [profile, authUser]);
  const avatarUrl = useMemo(() => profile?.avatar_url || '/placeholder.svg', [profile]);

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
    const fallbackImage = getFallbackImage(String(p.id));

    let rawImage = isValidUrl(p.image_url) ? p.image_url : fallbackImage;
    let rawImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images.filter(isValidUrl)
      : [rawImage];

    const isAd = p.content?.trim().startsWith('[AD]');
    const finalImage = isValidUrl(rawImage) ? rawImage : fallbackImage;

    let finalImages = Array.isArray(rawImages) && rawImages.length > 0
      ? rawImages.filter(isValidUrl)
      : [finalImage];

    return {
      id: p.id,
      isAd,
      isGif: false,
      isInfluencer: false,
      user: {
        id: p.user_id,
        name: p.user_name || '탐험가',
        avatar: p.user_avatar || '/placeholder.svg'
      },

      content: p.content?.replace(/^\[AD\]\s*/, '') || '',
      location: p.location_name || '알 수 없는 장소',
      lat: p.latitude,
      lng: p.longitude,
      latitude: p.latitude,
      longitude: p.longitude,
      likes: Number(p.likes || 0),
      commentsCount: 0,
      comments: [],
      image: finalImage,
      image_url: finalImage,
      images: finalImages,
      videoUrl: p.video_url,
      isLiked: likedSet.has(p.id),
      isSaved: savedSet.has(p.id),
      createdAt: new Date(p.created_at),
      category: p.category || 'none'
    };
  };

  useEffect(() => {
    const fetchAllPosts = async () => {
      if (!authUser?.id || !id) return;

      setLoading(true);
      try {
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
          const { data, error } = await supabase
            .from('posts')
            .select(POST_COLUMNS)
            .eq('user_id', targetPost.user_id)
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) {
            console.error("[PostDetail] Error fetching user's posts:", error);
            postsToFormat = [targetPost];
          } else {
            postsToFormat = data || [targetPost];
          }
        }

        if (postsToFormat.length === 0) {
          setAllPosts([]);
          return;
        }

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
    if (!authUser?.id) return;
    let currentlyLiked = false;
    setAllPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      currentlyLiked = post.isLiked;
      return { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 };
    }));
    toggleLikeInDb(postId, authUser.id, currentlyLiked).then(ok => {
      if (!ok) {
        setAllPosts(prev => prev.map(post => post.id !== postId ? post
          : { ...post, isLiked: currentlyLiked, likes: currentlyLiked ? post.likes + 1 : post.likes - 1 }
        ));
      }
    });
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

  // 비로그인 유저: 딥링크 랜딩 페이지 표시 (hooks 이후에 조건부 렌더링)
  if (!authLoading && !authUser && id) {
    return <PostDeepLinkLanding postId={id} />;
  }

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

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
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="pt-16 shrink-0">
        <div className="sticky top-0 z-40 bg-white flex items-center px-4 h-14 border-b border-gray-50 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">
              {allPosts.length > 0 && allPosts[0].user.id === authUser?.id
                ? '내 컨텐츠'
                : allPosts.length > 0
                  ? `${allPosts[0].user.name}의 컨텐츠`
                  : '컨텐츠'}
            </h2>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-x-none"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {allPosts.map((p) => (
          <div key={p.id} id={`post-${p.id}`} className="scroll-mt-4">
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
    </div>
  );
};

export default PostDetail;