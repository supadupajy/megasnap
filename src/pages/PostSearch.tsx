"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, ChevronLeft, ImageIcon, Play, Heart, Hash, X, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage, getOptimizedMarkerImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { toggleLikeInDb } from '@/utils/like-utils';
import { showSuccess, showError } from '@/utils/toast';
import { getSearchHashtag } from '@/utils/hashtags';

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
  hashtags?: string[];
  profiles?: { nickname: string | null; avatar_url: string | null };
}

const CACHE_KEY_QUERY = 'postSearch_query';
const CACHE_KEY_RESULTS = 'postSearch_results';

const POST_COLUMNS = 'id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, created_at, user_id, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)';

const sanitizePostgrestSearchTerm = (term: string) =>
  term.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();

// ── 검색 결과 클릭 시 뜨는 PostDetail 페이지 레이아웃 ─────────────────
// 페이지 전체를 덮어 검색 결과를 가린 상태로 상세를 보여준다.
const PostDetailFullPage = ({
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
      hashtags: p.hashtags || [],
    };
  };

  useEffect(() => {
    const fetch = async () => {
      if (!authUser?.id || !postId) return;
      setLoading(true);
      try {
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
        const el = document.getElementById(`page-post-${postId}`);
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
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
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden z-[200]">
      {/* 고정 상단 헤더
          - z-[100]: PostDetailFullPage 컨테이너(z-[200])가 만든 stacking context 안에서
            스크롤 영역의 영상 음소거 버튼(z-30) 등 모든 영상 오버레이보다 위에 표시되어야 한다. */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] pt-[64px] inset-x-0 z-[100] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            aria-label="검색 결과로 돌아가기"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">검색 결과</h2>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 120px)', paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : allPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 py-20">
            <p className="text-slate-500 font-bold mb-4">게시물을 찾을 수 없습니다.</p>
            <button onClick={onClose} className="text-indigo-600 font-black">뒤로 가기</button>
          </div>
        ) : (
          <div className="flex flex-col">
            {allPosts.map((p) => (
              <div
                key={p.id}
                id={`page-post-${p.id}`}
                style={{ scrollMarginTop: 'calc(env(safe-area-inset-top, 0px) + 128px)' }}
              >
                <PostItem
                  post={p}
                  disablePulse={true}
                  autoPlayVideo={true}
                  onLikeToggle={() => handleLikeToggle(p.id)}
                  onDelete={() => handlePostDelete(p.id)}
                  onLocationClick={(_e, lat, lng) =>
                    navigate('/', { state: { center: { lat, lng }, zoom: 16, post: p } })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── 포스팅 검색 페이지 ─────────────────────────────────────────────
const PostSearch = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<SearchPost[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const debounceInitRef = useRef(false);
  const initialSearchRanRef = useRef(false);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

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
      const hashtag = getSearchHashtag(trimmed);
      const textTerm = sanitizePostgrestSearchTerm(trimmed.replace(/^#/, ''));

      const textQuery = textTerm
        ? supabase
            .from('posts')
            .select('id, content, image_url, images, video_url, likes, created_at, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)')
            .or(`content.ilike.%${textTerm}%,location_name.ilike.%${textTerm}%`)
            .order('likes', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null });

      const hashtagQuery = hashtag
        ? supabase
            .from('posts')
            .select('id, content, image_url, images, video_url, likes, created_at, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)')
            .contains('hashtags', [hashtag])
            .order('likes', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null });

      const [textResult, hashtagResult] = await Promise.all([textQuery, hashtagQuery]);
      if (textResult.error) throw textResult.error;
      if (hashtagResult.error) throw hashtagResult.error;

      const merged = new Map<string, any>();
      ((hashtagResult.data as any[]) || []).forEach((post) => merged.set(post.id, post));
      ((textResult.data as any[]) || []).forEach((post) => {
        if (!merged.has(post.id)) merged.set(post.id, post);
      });

      const fetched = Array.from(merged.values()).slice(0, 50);
      setResults(fetched);
      try { sessionStorage.setItem(CACHE_KEY_RESULTS, JSON.stringify(fetched)); } catch {}
    } catch (err) {
      console.error('[PostSearch] search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 초기 진입: URL query(?q=...) 또는 sessionStorage 캐시 복원
  useEffect(() => {
    if (initialSearchRanRef.current) return;
    initialSearchRanRef.current = true;

    const urlQuery = searchParams.get('q')?.trim() || '';

    if (urlQuery) {
      setSearchQuery(urlQuery);
      try {
        sessionStorage.setItem(CACHE_KEY_QUERY, urlQuery);
        sessionStorage.removeItem(CACHE_KEY_RESULTS);
      } catch {}
      handleSearch(urlQuery);
      return;
    }

    // 캐시 복원
    try {
      const cachedQuery = sessionStorage.getItem(CACHE_KEY_QUERY) || '';
      const cachedResultsRaw = sessionStorage.getItem(CACHE_KEY_RESULTS);
      setSearchQuery(cachedQuery);
      if (cachedQuery && cachedResultsRaw) {
        setResults(JSON.parse(cachedResultsRaw));
        setHasSearched(true);
      }
    } catch {}
  }, [searchParams, handleSearch]);

  // 디바운스 검색
  useEffect(() => {
    if (!debounceInitRef.current) {
      debounceInitRef.current = true;
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const getThumbnail = (post: SearchPost) => {
    const raw = Array.isArray(post.images) && post.images.length > 0
      ? post.images[0]
      : post.image_url;
    return raw ? getOptimizedMarkerImage(raw, post.id) : getFallbackImage(post.id);
  };

  const activeTag = getSearchHashtag(searchQuery);

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* 고정 상단 헤더 */}
      <div className="fixed top-[env(safe-area-inset-top,0px)] pt-[64px] inset-x-0 z-[100] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={() => navigate('/popular')}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">포스팅 검색</h2>
          </div>
        </div>
      </div>

      {/* 검색 입력창 */}
      <div className="shrink-0 bg-white z-[90] pt-[calc(env(safe-area-inset-top,0px)+122px)]">
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="키워드 또는 #해시태그로 검색"
              className="w-full pl-12 pr-12 h-12 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none text-sm font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-inner transition-all focus:border-indigo-300 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={!searchQuery}
            />
            {isSearching ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition active:scale-90"
                aria-label="검색어 지우기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {activeTag && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2.5 text-indigo-700">
              <Hash className="h-4 w-4 shrink-0" />
              <p className="text-xs font-black">
                #{activeTag} 태그와 일치하는 포스팅을 우선 검색 중
              </p>
            </div>
          )}
          {hasSearched && !isSearching && (
            <p className="mt-2 px-1 text-xs font-bold text-slate-400">
              {results.length.toLocaleString()}개의 결과
            </p>
          )}
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <SearchIcon className="h-8 w-8" />
              </div>
              <p className="text-base font-black text-slate-700">검색어를 입력해 보세요</p>
              <p className="mt-1 text-sm font-medium text-slate-400">
                키워드나 #해시태그로 포스팅을 찾을 수 있어요.
              </p>
            </div>
          ) : isSearching ? (
            <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <ImageIcon className="h-8 w-8" />
              </div>
              <p className="text-base font-black text-slate-700">결과가 없어요</p>
              <p className="mt-1 text-sm font-medium text-slate-400">
                "{searchQuery}"에 대한 포스팅이 없습니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-3 pt-3">
              {results.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPostId(post.id)}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 cursor-pointer active:scale-[0.97] transition-transform shadow-sm"
                >
                  <img
                    src={getThumbnail(post)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getFallbackImage(post.id);
                    }}
                  />
                  {post.video_url && (
                    <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                      <Play className="h-3.5 w-3.5 fill-white text-white" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-3 bottom-2 flex items-center justify-between">
                    <div className="min-w-0 max-w-[70%]">
                      <p className="truncate text-[11px] font-semibold text-white drop-shadow">
                        {(post.profiles?.nickname || post.user_name || '').slice(0, 12)}
                      </p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <p className="mt-0.5 truncate text-[10px] font-black text-indigo-100 drop-shadow">
                          #{post.hashtags.slice(0, 2).join(' #')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3 fill-white text-white" />
                      <span className="text-[10px] font-semibold text-white">
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

      {/* 포스트 상세 페이지 — 검색 결과 위를 덮음 */}
      {selectedPostId && (
        <PostDetailFullPage
          postId={selectedPostId}
          searchResults={results}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
};

export default PostSearch;
