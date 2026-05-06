"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, ChevronLeft, Video, Play, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { Loader2 } from 'lucide-react';
import { toggleLikeInDb } from '@/utils/like-utils';
import { showSuccess, showError } from '@/utils/toast';

interface SearchPost {
  id: string;
  content: string;
  image_url: string | null;
  images: string[];
  video_url: string | null;
  likes: number;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
  profiles?: { nickname: string | null; avatar_url: string | null };
}

const CACHE_KEY_QUERY = 'videoSearch_query';
const CACHE_KEY_RESULTS = 'videoSearch_results';

const POST_COLUMNS = 'id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, profiles!posts_user_id_fkey(nickname, avatar_url)';

// ── 인라인 PostDetail 오버레이 ──────────────────────────────────────
const PostDetailOverlay = ({
  postId,
  searchResults,
  onClose,
}: {
  postId: string;
  searchResults: SearchPost[];
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const isValidUrl = (url: any) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (/post\s*content/i.test(clean)) return false;
    if (!clean.startsWith('http')) return false;
    return true;
  };

  const mapDbToPost = (p: any, likedSet: Set<string>, savedSet: Set<string>): Post => {
    const fallbackImage = getFallbackImage(String(p.id));
    const rawImage = isValidUrl(p.image_url) ? p.image_url : fallbackImage;
    const rawImages =
      Array.isArray(p.images) && p.images.length > 0
        ? p.images.filter(isValidUrl)
        : [rawImage];
    const isAd = p.content?.trim().startsWith('[AD]');
    const finalImage = isValidUrl(rawImage) ? rawImage : fallbackImage;
    const finalImages = rawImages.length > 0 ? rawImages.filter(isValidUrl) : [finalImage];

    return {
      id: p.id,
      isAd,
      isGif: false,
      isInfluencer: false,
      user: { id: p.user_id, name: p.profiles?.nickname || p.user_name || '탐험가', avatar: p.profiles?.avatar_url || p.user_avatar || '/placeholder.svg' },
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
      category: p.category || 'none',
    };
  };

  useEffect(() => {
    const fetch = async () => {
      if (!authUser?.id || !postId) return;
      setLoading(true);
      try {
        // 검색 결과 목록에서 상세 데이터 조회 (user 전체 포스팅 X)
        const postIds = searchResults.map((p) => p.id);

        const { data: postsData } = await supabase
          .from('posts')
          .select(POST_COLUMNS)
          .in('id', postIds)
          .order('likes', { ascending: false })
          .limit(100);

        const postsToFormat = postsData || [];
        if (postsToFormat.length === 0) { setAllPosts([]); return; }

        const allIds = postsToFormat.map((p: any) => p.id);
        const [{ data: likesData }, { data: savedData }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', allIds),
          supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).in('post_id', allIds),
        ]);

        const likedSet = new Set((likesData || []).map((l: any) => l.post_id));
        const savedSet = new Set((savedData || []).map((s: any) => s.post_id));

        setAllPosts(postsToFormat.map((p: any) => mapDbToPost(p, likedSet, savedSet)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [authUser?.id, postId, searchResults]);

  useEffect(() => {
    if (postId && allPosts.length > 0) {
      setTimeout(() => {
        document.getElementById(`overlay-post-${postId}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 100);
    }
  }, [postId, allPosts]);

  const handleLikeToggle = (pid: string) => {
    if (!authUser?.id) return;
    let currentlyLiked = false;
    setAllPosts(prev => prev.map(post => {
      if (post.id !== pid) return post;
      currentlyLiked = post.isLiked;
      return { ...post, isLiked: !post.isLiked, likes: !post.isLiked ? post.likes + 1 : post.likes - 1 };
    }));
    toggleLikeInDb(pid, authUser.id, currentlyLiked).then(ok => {
      if (!ok) setAllPosts(prev => prev.map(post => post.id !== pid ? post
        : { ...post, isLiked: currentlyLiked, likes: currentlyLiked ? post.likes + 1 : post.likes - 1 }
      ));
    });
  };

  const handlePostDelete = async (pid: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', pid);
      if (error) throw error;
      setAllPosts(prev => prev.filter(p => p.id !== pid));
      showSuccess('게시물이 삭제되었습니다.');
      if (allPosts.length <= 1) onClose();
    } catch {
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden">
      {/* 앱 헤더 높이만큼 safe-area + 64px 확보 */}
      <div className="shrink-0 bg-white border-b border-gray-50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
        <div className="flex items-center px-4 h-14 relative">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">검색 결과</h2>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : allPosts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-gray-500 font-bold mb-4">게시물을 찾을 수 없습니다.</p>
          <button onClick={onClose} className="text-indigo-600 font-black">뒤로 가기</button>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto no-scrollbar"
          style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {allPosts.map((p) => (
            <div key={p.id} id={`overlay-post-${p.id}`} className="scroll-mt-4">
              <PostItem
                post={p}
                disablePulse={true}
                autoPlayVideo={true}
                onLikeToggle={() => handleLikeToggle(p.id)}
                onDelete={() => handlePostDelete(p.id)}
                onLocationClick={(e, lat, lng) =>
                  navigate('/', { state: { center: { lat, lng }, zoom: 16, post: p } })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 메인 VideoSearch ────────────────────────────────────────────────
const VideoSearch = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(CACHE_KEY_QUERY) || ''; } catch { return ''; }
  });
  const [results, setResults] = useState<SearchPost[]>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_RESULTS);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState<boolean>(() => {
    try { return !!sessionStorage.getItem(CACHE_KEY_QUERY); } catch { return false; }
  });

  // 오버레이로 열 postId (null이면 닫힘)
  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    try { sessionStorage.setItem(CACHE_KEY_QUERY, trimmed); } catch {}

    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      try { sessionStorage.removeItem(CACHE_KEY_RESULTS); } catch {}
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, images, video_url, likes, created_at, user_name, user_avatar, profiles!posts_user_id_fkey(nickname, avatar_url)')
        .or(`content.ilike.%${trimmed}%,location_name.ilike.%${trimmed}%`)
        .order('likes', { ascending: false })
        .limit(50);

      if (error) throw error;
      const fetched = (data as any[]) || [];
      setResults(fetched);
      try { sessionStorage.setItem(CACHE_KEY_RESULTS, JSON.stringify(fetched)); } catch {}
    } catch (err) {
      console.error('[VideoSearch] search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const getThumbnail = (post: SearchPost) => {
    if (Array.isArray(post.images) && post.images.length > 0) return post.images[0];
    if (post.image_url) return post.image_url;
    return getFallbackImage(post.id);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* 고정 상단 헤더 */}
      <div className="fixed top-[env(safe-area-inset-top,0px)] pt-[64px] inset-x-0 z-[100] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">포스팅 검색</h2>
          </div>
        </div>
      </div>

      {/* 검색 입력창 */}
      <div className="shrink-0 bg-white z-[90] pt-[calc(env(safe-area-inset-top,0px)+122px)]">
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="원하는 영상을 검색해 보세요"
              className="w-full pl-12 h-14 bg-white border-2 border-indigo-600 rounded-2xl outline-none font-semibold placeholder:text-gray-400 placeholder:font-semibold shadow-sm transition-all focus:ring-2 focus:ring-indigo-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={!searchQuery}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        {!hasSearched ? (
          <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-orange-300" />
            </div>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              원하는 영상을 검색해 보세요.
            </p>
          </div>
        ) : isSearching ? (
          <div className="px-3 pt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              "{searchQuery}"에 대한 결과가 없습니다.
            </p>
          </div>
        ) : (
          <div
            className="px-3 pt-3 grid grid-cols-2 gap-2"
            style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {results.map((post) => (
              <div
                key={post.id}
                onClick={() => setOverlayPostId(post.id)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer active:scale-[0.97] transition-transform shadow-sm"
              >
                <img
                  src={getThumbnail(post)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getFallbackImage(post.id);
                  }}
                />
                {post.video_url && (
                  <div className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                  <p className="text-white text-[11px] font-semibold truncate max-w-[70%] drop-shadow">
                    {(post.profiles?.nickname || post.user_name || '').slice(0, 12)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-white fill-white" />
                    <span className="text-white text-[10px] font-semibold">
                      {post.likes?.toLocaleString() ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 포스팅 상세 오버레이 (navigate 없이 같은 페이지 내에서 렌더) */}
      {overlayPostId && (
        <PostDetailOverlay
          postId={overlayPostId}
          searchResults={results}
          onClose={() => setOverlayPostId(null)}
        />
      )}
    </div>
  );
};

export default VideoSearch;