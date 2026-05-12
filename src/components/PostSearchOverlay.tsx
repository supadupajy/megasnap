"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, ChevronLeft, ImageIcon, Play, Heart, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage, getOptimizedMarkerImage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import PostItem from '@/components/PostItem';
import { Post } from '@/types';
import { Loader2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-[20002] bg-white flex flex-col overflow-hidden">
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
          className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-x-none"
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

// ── 전역 PostSearchOverlay ─────────────────────────────────────────
// 어디서든 `open-post-search` 이벤트를 dispatch하면 열린다.
// `close-post-search` 이벤트 또는 백버튼으로 닫힌다.
// 상위 라우트와 독립적으로 동작하여, 탭 이동 없이 검색을 띄울 수 있다.
const PostSearchOverlay = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<SearchPost[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);
  const overlayPostIdRef = useRef<string | null>(null);

  // 외부에서 dispatch한 initialQuery가 있으면 자동 검색
  const autoSearchOnOpenRef = useRef<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    overlayPostIdRef.current = overlayPostId;
  }, [overlayPostId]);

  // 검색 실행
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
      console.error('[PostSearchOverlay] search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // open/close 이벤트 리스너
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const initialQuery = typeof detail.initialQuery === 'string' ? detail.initialQuery.trim() : '';

      if (initialQuery) {
        setSearchQuery(initialQuery);
        autoSearchOnOpenRef.current = initialQuery;
        try {
          sessionStorage.setItem(CACHE_KEY_QUERY, initialQuery);
          sessionStorage.removeItem(CACHE_KEY_RESULTS);
        } catch {}
      } else {
        // 새로 검색 버튼으로 진입할 때는 캐시된 마지막 쿼리/결과를 복원
        try {
          const cachedQuery = sessionStorage.getItem(CACHE_KEY_QUERY) || '';
          const cachedResultsRaw = sessionStorage.getItem(CACHE_KEY_RESULTS);
          setSearchQuery(cachedQuery);
          if (cachedQuery && cachedResultsRaw) {
            setResults(JSON.parse(cachedResultsRaw));
            setHasSearched(true);
          } else {
            setResults([]);
            setHasSearched(false);
          }
        } catch {
          setSearchQuery('');
          setResults([]);
          setHasSearched(false);
        }
      }

      (window as any).__isPostSearchOpen = true;
      setIsOpen(true);
    };

    const handleClose = () => {
      (window as any).__isPostSearchOpen = false;
      setIsOpen(false);
      setOverlayPostId(null);
    };

    window.addEventListener('open-post-search', handleOpen);
    window.addEventListener('close-post-search', handleClose);
    window.addEventListener('close-post-search-by-back', handleClose);

    return () => {
      window.removeEventListener('open-post-search', handleOpen);
      window.removeEventListener('close-post-search', handleClose);
      window.removeEventListener('close-post-search-by-back', handleClose);
    };
  }, []);

  // 오픈 직후 initialQuery 자동 검색
  useEffect(() => {
    if (isOpen && autoSearchOnOpenRef.current) {
      const q = autoSearchOnOpenRef.current;
      autoSearchOnOpenRef.current = null;
      handleSearch(q);
    }
  }, [isOpen, handleSearch]);

  // 타이핑 디바운스 검색 (오픈 상태일 때만)
  useEffect(() => {
    if (!isOpen) return;
    // 첫 렌더(오픈 직후)는 위의 auto-search가 처리하므로 스킵
    if (!initRef.current) {
      initRef.current = true;
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, isOpen]);

  // 닫힐 때 init flag 리셋
  useEffect(() => {
    if (!isOpen) {
      initRef.current = false;
    }
  }, [isOpen]);

  const close = useCallback(() => {
    window.dispatchEvent(new CustomEvent('close-post-search'));
  }, []);

  const openPostOverlay = useCallback((postId: string) => {
    setOverlayPostId(postId);
  }, []);

  const closePostOverlay = useCallback(() => {
    setOverlayPostId(null);
  }, []);

  const getThumbnail = (post: SearchPost) => {
    const raw = Array.isArray(post.images) && post.images.length > 0
      ? post.images[0]
      : post.image_url;
    return raw ? getOptimizedMarkerImage(raw, post.id) : getFallbackImage(post.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20001] bg-white flex flex-col overflow-hidden">
      {/* 고정 상단 헤더 */}
      <div className="fixed top-[env(safe-area-inset-top,0px)] pt-[64px] inset-x-0 z-[10] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={close}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">검색</h2>
          </div>
        </div>
      </div>

      {/* 검색 입력창 */}
      <div className="shrink-0 bg-white z-[5] pt-[calc(env(safe-area-inset-top,0px)+122px)]">
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 z-10" />
            <input
              placeholder="키워드 또는 #해시태그로 검색해 보세요"
              className="w-full pl-12 h-14 bg-white border-2 border-indigo-600 rounded-2xl outline-none font-semibold placeholder:text-gray-400 placeholder:font-normal shadow-sm transition-all focus:ring-2 focus:ring-indigo-50"
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
          {(() => {
            const activeTag = getSearchHashtag(searchQuery);
            return activeTag ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700">
                <Hash className="h-4 w-4 shrink-0" />
                <p className="text-xs font-black">
                  #{activeTag} 태그와 일치하는 포스팅을 우선 검색 중
                </p>
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain bg-white">
        {!hasSearched ? (
          <div className="px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-orange-300" />
            </div>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              검색하면 결과가 여기에 나와요.
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
                onClick={() => openPostOverlay(post.id)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer active:scale-[0.97] transition-transform shadow-sm"
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
                  <div className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                  <div className="min-w-0 max-w-[70%]">
                    <p className="text-white text-[11px] font-semibold truncate drop-shadow">
                      {(post.profiles?.nickname || post.user_name || '').slice(0, 12)}
                    </p>
                    {post.hashtags && post.hashtags.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] font-black text-indigo-100 drop-shadow">
                        #{post.hashtags.slice(0, 2).join(' #')}
                      </p>
                    )}
                  </div>
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

      {/* 포스팅 상세 오버레이 */}
      {overlayPostId && (
        <PostDetailOverlay
          postId={overlayPostId}
          searchResults={results}
          onClose={closePostOverlay}
        />
      )}
    </div>
  );
};

export default PostSearchOverlay;
