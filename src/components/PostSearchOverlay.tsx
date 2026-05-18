"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, ChevronLeft, ImageIcon, Play, Heart, Hash, X, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage, getOptimizedFeedImage, formatCount } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import Header from '@/components/Header';
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
  video_urls?: (string | null)[];
  likes: number;
  created_at: string;
  user_id?: string;
  user_name: string;
  user_avatar: string | null;
  hashtags?: string[];
  profiles?: { nickname: string | null; avatar_url: string | null };
}

const CACHE_KEY_QUERY = 'postSearch_query';
const CACHE_KEY_RESULTS = 'postSearch_results';
const POST_COLUMNS = 'id, content, image_url, images, location_name, latitude, longitude, likes, category, video_url, video_urls, created_at, user_id, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)';

const sanitizePostgrestSearchTerm = (term: string) =>
  term.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();

const getInitialPostSearchResults = (): SearchPost[] => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_RESULTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const PostDetailFullPage = ({
  postId,
  searchResults,
  onClose,
}: {
  postId: string;
  searchResults: SearchPost[];
  onClose: () => void;
}) => {
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

  const mapDbToPost = (post: any, likedSet: Set<string>, savedSet: Set<string>): Post => {
    const fallbackImage = getFallbackImage(String(post.id));
    const rawImage = isValidUrl(post.image_url) ? post.image_url : fallbackImage;
    const rawImages =
      Array.isArray(post.images) && post.images.length > 0
        ? post.images.filter(isValidUrl)
        : [rawImage];
    const isAd = post.content?.trim().startsWith('[AD]');
    const finalImage = isValidUrl(rawImage) ? rawImage : fallbackImage;
    const finalImages = rawImages.length > 0 ? rawImages.filter(isValidUrl) : [finalImage];

    return {
      id: post.id,
      isAd,
      isGif: false,
      isInfluencer: false,
      user: {
        id: post.user_id,
        name: post.profiles?.nickname || post.user_name || '탐험가',
        avatar: post.profiles?.avatar_url || post.user_avatar || '/placeholder.svg',
      },
      content: post.content?.replace(/^\[AD\]\s*/, '') || '',
      location: post.location_name || '알 수 없는 장소',
      lat: post.latitude,
      lng: post.longitude,
      latitude: post.latitude,
      longitude: post.longitude,
      likes: Number(post.likes || 0),
      commentsCount: 0,
      comments: [],
      image: finalImage,
      image_url: finalImage,
      images: finalImages,
      videoUrl: post.video_url,
      videoUrls: Array.isArray(post.video_urls) ? post.video_urls : undefined,
      isLiked: likedSet.has(post.id),
      isSaved: savedSet.has(post.id),
      createdAt: new Date(post.created_at),
      category: post.category || 'none',
      hashtags: post.hashtags || [],
    };
  };

  useEffect(() => {
    const fetchPosts = async () => {
      if (!authUser?.id || !postId) return;

      setLoading(true);
      try {
        const postIds = searchResults.map((post) => post.id);

        const { data: postsData } = await supabase
          .from('posts')
          .select(POST_COLUMNS)
          .in('id', postIds)
          .order('likes', { ascending: false })
          .limit(100);

        const postsToFormat = postsData || [];
        if (postsToFormat.length === 0) {
          setAllPosts([]);
          return;
        }

        const allIds = postsToFormat.map((post: any) => post.id);
        const [{ data: likesData }, { data: savedData }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', authUser.id).in('post_id', allIds),
          supabase.from('saved_posts').select('post_id').eq('user_id', authUser.id).in('post_id', allIds),
        ]);

        const likedSet = new Set((likesData || []).map((like: any) => like.post_id));
        const savedSet = new Set((savedData || []).map((saved: any) => saved.post_id));

        setAllPosts(postsToFormat.map((post: any) => mapDbToPost(post, likedSet, savedSet)));
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [authUser?.id, postId, searchResults]);

  useEffect(() => {
    if (postId && allPosts.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`page-post-${postId}`);
        element?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 100);
    }
  }, [postId, allPosts]);

  const handleLikeToggle = (targetPostId: string) => {
    if (!authUser?.id) return;

    let currentlyLiked = false;
    setAllPosts((prev) =>
      prev.map((post) => {
        if (post.id !== targetPostId) return post;
        currentlyLiked = post.isLiked;
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: !post.isLiked ? post.likes + 1 : post.likes - 1,
        };
      })
    );

    toggleLikeInDb(targetPostId, authUser.id, currentlyLiked).then((ok) => {
      if (!ok) {
        setAllPosts((prev) =>
          prev.map((post) =>
            post.id !== targetPostId
              ? post
              : {
                  ...post,
                  isLiked: currentlyLiked,
                  likes: currentlyLiked ? post.likes + 1 : post.likes - 1,
                }
          )
        );
      }
    });
  };

  const handlePostDelete = async (targetPostId: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', targetPostId);
      if (error) throw error;

      setAllPosts((prev) => prev.filter((post) => post.id !== targetPostId));
      showSuccess('게시물이 삭제되었습니다.');

      if (allPosts.length <= 1) onClose();
    } catch {
      showError('게시물 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden z-[200]">
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
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 120px)', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
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
            {allPosts.map((post) => (
              <div
                key={post.id}
                id={`page-post-${post.id}`}
                style={{ scrollMarginTop: 'calc(env(safe-area-inset-top, 0px) + 128px)' }}
              >
                <PostItem
                  post={post}
                  disablePulse={true}
                  autoPlayVideo={true}
                  onLikeToggle={() => handleLikeToggle(post.id)}
                  onDelete={() => handlePostDelete(post.id)}
                  onLocationClick={() => {}}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PostSearchOverlay = () => {
  const { session } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchPost[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const debounceInitRef = useRef(false);
  const skipNextDebounceRef = useRef(false);

  const closeOverlay = useCallback(() => {
    setSelectedPostId(null);
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('close-post-search-overlay'));
  }, []);

  const openOverlay = useCallback((query?: string) => {
    const nextQuery = query?.trim() || '';

    setIsOpen(true);
    setSelectedPostId(null);

    if (nextQuery) {
      skipNextDebounceRef.current = true;
      setSearchQuery(nextQuery);
      try {
        sessionStorage.setItem(CACHE_KEY_QUERY, nextQuery);
        sessionStorage.removeItem(CACHE_KEY_RESULTS);
      } catch {}
    } else {
      try {
        const cachedQuery = sessionStorage.getItem(CACHE_KEY_QUERY) || '';
        setSearchQuery(cachedQuery);
        setResults(getInitialPostSearchResults());
        setHasSearched(!!cachedQuery);
      } catch {
        setSearchQuery('');
        setResults([]);
        setHasSearched(false);
      }
    }

    window.dispatchEvent(new CustomEvent('open-post-search-overlay'));
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      openOverlay(detail?.query);
    };

    const handleClose = () => closeOverlay();

    window.addEventListener('open-post-search-overlay', handleOpen);
    window.addEventListener('close-post-search-overlay', handleClose);

    return () => {
      window.removeEventListener('open-post-search-overlay', handleOpen);
      window.removeEventListener('close-post-search-overlay', handleClose);
    };
  }, [openOverlay, closeOverlay]);

  useEffect(() => {
    if (!isOpen) return;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const previousState = history.state || {};
    history.pushState({ ...previousState, postSearchOverlayOpen: true }, '');

    const handlePopState = () => {
      setSelectedPostId(null);
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent('close-post-search-overlay'));
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();

    try {
      sessionStorage.setItem(CACHE_KEY_QUERY, trimmed);
    } catch {}

    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      try {
        sessionStorage.removeItem(CACHE_KEY_RESULTS);
      } catch {}
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
            .select('id, content, image_url, images, video_url, video_urls, likes, created_at, user_id, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)')
            .or(`content.ilike.%${textTerm}%,location_name.ilike.%${textTerm}%`)
            .order('likes', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null });

      const hashtagQuery = hashtag
        ? supabase
            .from('posts')
            .select('id, content, image_url, images, video_url, video_urls, likes, created_at, user_id, user_name, user_avatar, hashtags, profiles!posts_user_id_fkey(nickname, avatar_url)')
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

      try {
        sessionStorage.setItem(CACHE_KEY_RESULTS, JSON.stringify(fetched));
      } catch {}
    } catch (error) {
      console.error('[PostSearchOverlay] search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (!debounceInitRef.current) {
      debounceInitRef.current = true;
      return;
    }

    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      handleSearch(searchQuery);
      return;
    }

    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, handleSearch]);

  const getThumbnail = (post: SearchPost) => {
    const raw = Array.isArray(post.images) && post.images.length > 0
      ? post.images[0]
      : post.image_url;

    return raw ? getOptimizedFeedImage(raw, post.id) : getFallbackImage(post.id);
  };

  const activeTag = getSearchHashtag(searchQuery);

  if (!session || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[30000] bg-white flex flex-col overflow-hidden">
      <Header />

      <div className="fixed top-[calc(env(safe-area-inset-top,0px)+64px)] inset-x-0 z-[30100] bg-white">
        <div className="px-4 bg-white border-b border-gray-50 flex items-center h-14 relative">
          <button
            onClick={() => {
              if (history.state?.postSearchOverlayOpen) {
                history.back();
                return;
              }
              closeOverlay();
            }}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            aria-label="닫기"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">컨텐츠 검색</h2>
          </div>
        </div>
      </div>

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
                #{activeTag} 태그와 일치하는 컨텐츠를 우선 검색 중
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

      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-white">
        <div style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <SearchIcon className="h-8 w-8" />
              </div>
              <p className="text-base font-black text-slate-700">검색어를 입력해 보세요</p>
              <p className="mt-1 text-sm font-medium text-slate-400">
                키워드나 #해시태그로 컨텐츠를 찾을 수 있어요.
              </p>
            </div>
          ) : isSearching ? (
            <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <ImageIcon className="h-8 w-8" />
              </div>
              <p className="text-base font-black text-slate-700">결과가 없어요</p>
              <p className="mt-1 text-sm font-medium text-slate-400">
                "{searchQuery}"에 대한 컨텐츠가 없습니다.
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
                  {(post.video_url || (Array.isArray(post.video_urls) && post.video_urls.length > 0)) && (
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
                        {formatCount(post.likes ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

export default PostSearchOverlay;