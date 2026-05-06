"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, ChevronLeft, Video, Play, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage } from '@/lib/utils';

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

const VideoSearch = () => {
  const navigate = useNavigate();

  // sessionStorage에서 이전 검색어/결과 복원
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

  const isFirstRender = useRef(true);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();

    // sessionStorage에 검색어 저장
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
      // 결과도 sessionStorage에 저장
      try { sessionStorage.setItem(CACHE_KEY_RESULTS, JSON.stringify(fetched)); } catch {}
    } catch (err) {
      console.error('[VideoSearch] search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 첫 렌더 시 캐시된 검색어가 있으면 검색 스킵 (이미 결과 복원됨)
  // 이후 searchQuery 변경 시에만 디바운스 검색
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

  const hasVideo = (post: SearchPost) => !!post.video_url;

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
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">영상 검색</h2>
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
          /* 초기 상태 */
          <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-orange-300" />
            </div>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              원하는 영상을 검색해 보세요.
            </p>
          </div>
        ) : isSearching ? (
          /* 로딩 스켈레톤 */
          <div className="px-3 pt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          /* 결과 없음 */
          <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              "{searchQuery}"에 대한 결과가 없습니다.
            </p>
          </div>
        ) : (
          /* 2열 그리드 결과 */
          <div
            className="px-3 pt-3 grid grid-cols-2 gap-2"
            style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {results.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer active:scale-[0.97] transition-transform shadow-sm"
              >
                {/* 썸네일 */}
                <img
                  src={getThumbnail(post)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getFallbackImage(post.id);
                  }}
                />

                {/* 영상 뱃지 */}
                {hasVideo(post) && (
                  <div className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}

                {/* 하단 그라디언트 + 좋아요 */}
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
    </div>
  );
};

export default VideoSearch;
