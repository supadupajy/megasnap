"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapContainer from '@/components/MapContainer';
import TrendingPosts from '@/components/TrendingPosts';
import PostDetail from '@/components/PostDetail';
import WritePost from '@/components/WritePost';
import TimeSlider from '@/components/TimeSlider';
import PlaceSearch from '@/components/PlaceSearch';
import CategoryMenu from '@/components/CategoryMenu';
import PostListOverlay from '@/components/PostListOverlay';
import { RefreshCw, LayoutGrid, Navigation, Search, Layers, Check, X, Loader2 } from 'lucide-react';
import { Post } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import { useViewedPosts } from '@/hooks/use-viewed-posts';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { mapCache } from '@/utils/map-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostsInBounds } from '@/hooks/use-supabase-posts';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { postDraftStore } from '@/utils/post-draft-store';
import { sanitizeYoutubeMedia } from '@/utils/youtube-utils';
import confetti from 'canvas-confetti';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop&w=800&q=80';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const [allPosts, setAllPosts] = useState<Post[]>(mapCache.posts);
  const [globalTrendingPosts, setGlobalTrendingPosts] = useState<Post[]>([]);
  const [displayedMarkers, setDisplayedMarkers] = useState<Post[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(mapCache.lastCenter);
  // ✅ 5단계를 명시적으로 디폴트 설정 (기존 캐시 무시하도록 강제 가능)
  const [currentZoom, setCurrentZoom] = useState<number>(mapCache.lastZoom || 5);
  
  const { viewedIds, markAsViewed } = useViewedPosts();
  const { blockedIds } = useBlockedUsers();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPostListOpen, setIsPostListOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeValue, setTimeValue] = useState(48); 
  const [isWriteOpen, setIsWriteOpen] = useState(false);

  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [finalSelectedLocation, setFinalSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResultLocation, setSearchResultLocation] = useState<{ lat: number; lng: number } | null>(null);

  const throttleTimer = useRef<any>(null);
  const isSyncing = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (authUser) {
      console.log('[DEBUG] Current Auth User ID:', authUser.id);
    }
  }, [authUser]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const handleCloseOverlay = () => {
      console.log('[Index] Received close signal from native back button');
      if (isPostListOpen) {
        setIsPostListOpen(false);
      }
    };
    window.addEventListener('close-post-list-overlay', handleCloseOverlay);
    return () => window.removeEventListener('close-post-list-overlay', handleCloseOverlay);
  }, [isPostListOpen]);

  useEffect(() => {
    const currentState = window.history.state || {};
    if (currentState.isPostListOpen !== isPostListOpen) {
      window.history.replaceState({ 
        ...currentState, 
        isPostListOpen,
        usr: { ...currentState.usr, isPostListOpen }
      }, '');
    }
  }, [isPostListOpen]);

  useEffect(() => {
    const handleOpenWrite = () => setIsWriteOpen((prev) => !prev);
    window.addEventListener('open-write-post', handleOpenWrite);
    return () => window.removeEventListener('open-write-post', handleOpenWrite);
  }, []);

  const getTierFromId = (id: string, likes: number = 0) => {
    // [FIX] 실버 및 상위 티어 할당 로직 완화 (좋아요 기준 하향 및 확률 상향)
    if (likes >= 5000) return 'diamond';
    if (likes >= 2000) return 'gold';
    if (likes >= 500) return 'silver'; // 기존 2000 -> 500으로 대폭 하향
    if (likes >= 100) return 'popular'; // 기존 500 -> 100으로 하향
    
    // 데이터가 적을 때를 대비한 해시 기반 할당 확률 대폭 상향
    if (!id || id.length < 5) return 'none';
    let h = 0;
    for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
    const val = Math.abs(h % 1000) / 1000;
    
    if (val < 0.05) return 'diamond'; // 1% -> 5%
    if (val < 0.15) return 'gold';    // 3% -> 15%
    if (val < 0.35) return 'silver';  // 7% -> 35%
    if (val < 0.60) return 'popular'; // 15% -> 60%
    return 'none';
  };

  const mapDbToPost = useCallback(async (rawPost: any): Promise<Post> => {
    if (!rawPost || !rawPost.id) return null as any;
    try {
      // [FIX] 400 Bad Request 해결: 
      // posts.user_id가 TEXT 타입이고 profiles.id가 UUID 타입인 경우 JOIN 시 타입 오류가 발생할 수 있습니다.
      // 먼저 posts 데이터만 가져오고, 그 다음에 profiles 데이터를 별도로 가져와 클라이언트에서 합칩니다.
      
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', rawPost.id)
        .single();

      if (postError || !postData) throw postError || new Error('Post not found');

      const p = postData;
      const contentText = p.content || '';
      const isAd = contentText.trim().startsWith('[AD]');
      const likesCount = Number(p.likes || 0);

      // [FIX] 고장난 Unsplash URL 차단 및 자동 교체 블랙리스트
      const BROKEN_URL_PART = "photo-1548199973-03cbf5292374";
      const HIGH_RES_FALLBACK = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90";

      const sanitizeUrl = (url: any) => {
        if (!url || typeof url !== 'string' || url.includes(BROKEN_URL_PART)) {
          return HIGH_RES_FALLBACK + "&sig=" + p.id;
        }
        // Unsplash인 경우 무조건 고해상도 파라미터 강제
        if (url.includes('unsplash.com')) {
          return url.split('?')[0] + "?auto=format&fit=crop&w=1200&q=90";
        }
        return url;
      };

      let finalImage = sanitizeUrl(p.image_url);
      
      const validImages = Array.isArray(p.images) && p.images.length > 0
        ? p.images.map(img => sanitizeUrl(img))
        : [finalImage];

      // [FIX] borderType 결정 시 isAd 조건보다 likesCount 조건을 우선하거나 병합 검토
      // 광고이면서 인기글일 수는 없으므로, 광고가 아닐 때만 티어/인기 체크
      let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';
      
      if (likesCount >= 10000) {
        borderType = 'popular'; // 좋아요 1만개 이상이면 최우선으로 빨간색 테두리
      } else if (!isAd) {
        // ID 해시를 사용하여 고정된 확률값 생성
        let h = 0;
        const idStr = p.id.toString();
        for(let i = 0; i < idStr.length; i++) h = Math.imul(31, h) + idStr.charCodeAt(i) | 0;
        const val = Math.abs(h % 1000) / 1000;
        
        if (val < 0.03) borderType = 'diamond';      // 3%
        else if (val < 0.08) borderType = 'gold';    // 5%
      }
      
      // 작성자 프로필 정보 별도 조회
      let userName = p.user_name || '탐험가';
      let userAvatar = p.user_avatar || '';

      if (p.user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('nickname, avatar_url')
          .eq('id', p.user_id)
          .maybeSingle();

        if (profileData) {
          userName = profileData.nickname || userName;
          userAvatar = profileData.avatar_url || userAvatar;
        }
      }

      const SAFE_FALLBACK = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=90";
      
      const contentText2 = p.content || '';
      const isAd2 = contentText2.trim().startsWith('[AD]');
      
      const isValidUrl = (url: any) => {
        if (!url || typeof url !== 'string') return false;
        const clean = url.trim();
        if (/post\s*content/i.test(clean)) return false;
        if (!clean.startsWith('http')) return false;
        if (clean.length < 20) return false;
        return true;
      };

      const preSanitizedRaw = { ...rawPost };
      preSanitizedRaw.image_url = isValidUrl(preSanitizedRaw.image_url) ? preSanitizedRaw.image_url : SAFE_FALLBACK;
      
      if (Array.isArray(preSanitizedRaw.images) && preSanitizedRaw.images.length > 0) {
        preSanitizedRaw.images = preSanitizedRaw.images.map((img: any) => isValidUrl(img) ? img : SAFE_FALLBACK);
      } else {
        preSanitizedRaw.images = [preSanitizedRaw.image_url];
      }

      const p2 = await sanitizeYoutubeMedia(preSanitizedRaw);
      
      // [FIX] [AD] 태그를 감지하여 isAd 플래그를 정확히 설정
      const contentText3 = p2.content || '';
      const isAd3 = contentText3.trim().startsWith('[AD]');
      
      let finalImage2 = p2.image_url;
      if (isValidUrl(finalImage2) && finalImage2.includes('unsplash.com')) {
        finalImage2 = finalImage2.split('?')[0] + "?auto=format&fit=crop&w=1200&q=90";
      }

      if (p2.youtube_url) {
        finalImage2 = getYoutubeThumbnail(p2.youtube_url) || finalImage2;
      }
      
      if (!isValidUrl(finalImage2)) finalImage2 = SAFE_FALLBACK;

      const validImages2 = Array.isArray(p2.images) && p2.images.length > 0
        ? p2.images.map(img => {
            if (isValidUrl(img) && img.includes('unsplash.com')) {
              return img.split('?')[0] + "?auto=format&fit=crop&w=1200&q=90";
            }
            return isValidUrl(img) ? img : SAFE_FALLBACK;
          })
        : [finalImage2];

      return {
        id: p.id,
        isAd: isAd3, // 이제 [AD]로 시작하는 글은 true로 설정됨
        isGif: false,
        isInfluencer: ['gold', 'diamond'].includes(borderType),
        user: { 
          id: p.user_id || '', 
          name: userName, 
          avatar: userAvatar 
        },
        content: contentText3.replace(/^\[AD\]\s*/, '') || '',
        location: p.location_name || '알 수 없는 장소',
        lat: p.latitude,
        lng: p.longitude,
        likes: likesCount,
        commentsCount: 0,
        comments: [],
        image: finalImage2,
        images: validImages2,
        youtubeUrl: p2.youtube_url,
        videoUrl: p2.video_url,
        category: p.category || 'none',
        isLiked: false,
        createdAt: new Date(p.created_at),
        borderType // [CRITICAL] 여기서 결정된 borderType이 Post 객체에 정확히 담겨야 함
      };
    } catch (err) { return null as any; }
  }, []);

  const fetchGlobalTrending = useCallback(async () => {
    try {
      // [FIX] 좋아요 순이 아닌 전체 포스팅에서 랜덤으로 50개를 가져와 리스트 구성
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('id') // 고정된 랜덤성을 위해 ID 순으로 가져온 뒤 클라이언트에서 섞음
        .limit(100);

      if (!error && data) {
        // 클라이언트 사이드에서 랜덤하게 섞기
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        const mapped = await Promise.all(shuffled.map(mapDbToPost));
        
        // 유효한 포스트만 필터링 (광고 포함 여부는 사용자 요청에 따라 유동적일 수 있으나 일단 일반/인기/인플루언서 위주)
        const filtered = mapped.filter(p => p !== null).slice(0, 20);
        
        // 순위 부여 (1위~20위)
        const ranked = filtered.map((p, idx) => ({ ...p, rank: idx + 1 }));
        setGlobalTrendingPosts(ranked);
      }
    } catch (err) { console.error(err); }
  }, [mapDbToPost]);

  useEffect(() => { if (authUser) fetchGlobalTrending(); }, [authUser, fetchGlobalTrending]);

  useEffect(() => {
    if (!authUser) return;

    console.log('[Realtime] Initializing posts subscription...');

    // 이전에 생성된 채널이 있다면 제거 (중복 구독 방지)
    const oldChannel = supabase.getChannels().find(c => (c as any).topic === 'realtime:public:posts' || (c as any).name === 'global-posts-updates');
    if (oldChannel) supabase.removeChannel(oldChannel);

    const channel = supabase
      .channel('global-posts-updates')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'posts' 
        },
        async (payload) => {
          const newPostRaw = payload.new;
          console.log('[Realtime] Message received! New post ID:', newPostRaw.id);

          if (!newPostRaw || newPostRaw.latitude === null || newPostRaw.longitude === null) {
            console.log('[Realtime] Invalid post data received (null coordinates)');
            return;
          }

          // 최신 Bounds를 확인하기 위해 ref가 아닌 mapData에서 직접 가져오기
          // 이 useEffect는 mapData.bounds가 변경될 때마다 재실행되므로 항상 최신 범위를 참조함
          const bounds = mapData?.bounds;
          if (!bounds) {
            console.log('[Realtime] Map bounds not ready yet');
            return;
          }

          const { sw, ne } = bounds;
          const isInBounds = 
            newPostRaw.latitude >= Math.min(sw.lat, ne.lat) &&
            newPostRaw.latitude <= Math.max(sw.lat, ne.lat) &&
            newPostRaw.longitude >= Math.min(sw.lng, ne.lng) &&
            newPostRaw.longitude <= Math.max(sw.lng, ne.lng);

          console.log(`[Realtime] Bounds check result: ${isInBounds} for lat: ${newPostRaw.latitude}, lng: ${newPostRaw.longitude}`);

          if (isInBounds && newPostRaw.user_id !== authUser.id) {
            console.log('[Realtime] MATCH! Adding to map and firing local fireworks');

            const newPost: Post = {
              id: newPostRaw.id,
              isAd: false,
              isGif: false,
              isInfluencer: false,
              user: { id: '', name: '...', avatar: '' },
              content: '',
              location: '...',
              lat: newPostRaw.latitude,
              lng: newPostRaw.longitude,
              likes: 0,
              commentsCount: 0,
              comments: [],
              image: newPostRaw.image_url,
              videoUrl: newPostRaw.video_url,
              youtubeUrl: newPostRaw.youtube_url,
              category: newPostRaw.category || 'none',
              isLiked: false,
              createdAt: new Date(newPostRaw.created_at),
              borderType: 'none',
              isNewRealtime: true
            };

            setAllPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });

            // 폭죽 효과를 전체 화면이 아닌 마커 위치 부근에서 터지도록 좌표 계산
            // 카카오맵 좌표를 화면 좌표로 변환하기는 복잡하므로,
            // 캔버스 컨페티의 origin을 지도상의 대략적인 위치로 계산 (내 지도 중심 기준)
            const mapCenter = mapData?.center;
            if (mapCenter) {
              const relX = 0.5 + (newPostRaw.longitude - mapCenter.lng) * 5; // 화면 비율 보정
              const relY = 0.5 - (newPostRaw.latitude - mapCenter.lat) * 5;

              confetti({
                particleCount: 15, // 수량 대폭 축소
                spread: 40,
                origin: { 
                  x: Math.max(0.1, Math.min(0.9, relX)), 
                  y: Math.max(0.1, Math.min(0.9, relY)) 
                },
                colors: ['#4F46E5', '#F59E0B'],
                ticks: 100,
                gravity: 1.5,
                scalar: 0.7, // 크기 축소
                zIndex: 15000
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] Subscription status: ${status}`);
        if (err) console.error('[Realtime] Subscription error:', err);
      });

    return () => {
      console.log('[Realtime] Component cleanup: Unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, mapData?.bounds]); // Bounds가 바뀔 때마다 구독을 최신 범위 기준으로 유지

  useEffect(() => { fetchGlobalTrending(); }, [fetchGlobalTrending]);

  const syncPostsWithSupabase = useCallback(async (forceBounds?: any, forceZoom?: number) => {
    const targetBounds = forceBounds || mapData?.bounds;
    if (!targetBounds) return;
    if (isSyncing.current && !forceBounds) return;
    isSyncing.current = true;
    const { sw, ne } = targetBounds;
    const center = mapData?.center;
    const zoomToUse = forceZoom ?? currentZoom;
    try {
      const dbPosts = await fetchPostsInBounds(sw, ne, zoomToUse, center);

      // 서버에서 가져온 포스트 ID 셋 (현재 화면 범위 내 유효한 포스트들)
      const validDbIds = new Set(dbPosts.map(p => p.id));

      const mappedPosts: Post[] = await Promise.all(dbPosts.map(p => mapDbToPost(p)));

      // [FIX] 상대방이 삭제한 포스트 감지 및 애니메이션 처리
      setAllPosts(prev => {
        // 현재 화면 범위 내에 있는데 서버 응답(dbPosts)에 없는 포스트 식별
        const deletedPostsInView = prev.filter(p => {
          const isInCurrentBounds = 
            p.lat >= Math.min(sw.lat, ne.lat) && 
            p.lat <= Math.max(sw.lat, ne.lat) && 
            p.lng >= Math.min(sw.lng, ne.lng) && 
            p.lng <= Math.max(sw.lng, ne.lng);

          return isInCurrentBounds && !validDbIds.has(p.id) && !p.isNewRealtime;
        });

        // 삭제된 포스트들에 대해 애니메이션 이벤트 발송
        deletedPostsInView.forEach(p => {
          window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id: p.id } }));
        });

        // 애니메이션을 위해 즉시 제거하지 않고, 애니메이션이 끝날 즈음 필터링된 목록을 반환하기 위해
        // 일단은 유지하되, 별도의 타임아웃으로 실제 상태에서 제거 유도
        if (deletedPostsInView.length > 0) {
          setTimeout(() => {
            setAllPosts(current => current.filter(p => !deletedPostsInView.some(d => d.id === p.id)));
            setDisplayedMarkers(current => current.filter(p => !deletedPostsInView.some(d => d.id === p.id)));
          }, 400);
          return prev; // 이번 렌더링에서는 유지
        }

        const existingIds = new Set(prev.map(p => p.id));
        const newUnique = mappedPosts.filter(p => !existingIds.has(p.id));

        if (newUnique.length === 0 && !forceBounds) return prev;

        const combined = [...newUnique, ...prev].slice(0, 3000);
        mapCache.posts = combined;
        return combined;
      });
    } catch (err) { console.error(err); } finally { isSyncing.current = false; }
  }, [mapData, currentZoom, mapDbToPost]);

  const handleMapChange = useCallback((data: any) => {
    if (!isSelectingLocation) { setFinalSelectedLocation(null); postDraftStore.clear(); }
    const zoomChanged = data.level !== undefined && data.level !== currentZoom;
    if (zoomChanged) {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      setMapData(data);
      setCurrentZoom(data.level);
      mapCache.lastCenter = data.center;
      mapCache.lastZoom = data.level;
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      setFinalSelectedLocation(null);
      setTimeout(() => { syncPostsWithSupabase(data.bounds, data.level); }, 50);
      return;
    }
    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      setMapData(data);
      mapCache.lastCenter = data.center;
      if (data.level !== undefined) { setCurrentZoom(data.level); mapCache.lastZoom = data.level; }
      if (isSelectingLocation) setTempSelectedLocation(data.center);
      throttleTimer.current = null;
    }, 100);
  }, [isSelectingLocation, currentZoom, syncPostsWithSupabase]);

  useEffect(() => { if (mapData) syncPostsWithSupabase(); }, [mapData, syncPostsWithSupabase]);

  useEffect(() => {
    if (!mapData?.bounds) return;
    if (currentZoom >= 9) { if (displayedMarkers.length > 0) setDisplayedMarkers([]); return; }
    const { sw, ne } = mapData.bounds;
    const now = Date.now();
    const timeLimitMs = timeValue * 60 * 60 * 1000;
    const inBoundsCandidates = allPosts.filter(post => {
      if (!post || post.lat === null || post.lng === null) return false;
      if (blockedIds.has(post.user.id)) return false;
      const isInBounds = 
        post.lat >= Math.min(sw.lat, ne.lat) && 
        post.lat <= Math.max(sw.lat, ne.lat) && 
        post.lng >= Math.min(sw.lng, ne.lng) && 
        post.lng <= Math.max(sw.lng, ne.lng);
      if (!isInBounds) return false;
      if (post.isAd) return true;
      if (timeValue < 100 && (now - post.createdAt.getTime()) > timeLimitMs) return false;
      let matches = false;
      if (selectedCategories.includes('mine')) matches = authUser && post.user.id === authUser.id;
      else if (selectedCategories.includes('all')) matches = true;
      else matches = selectedCategories.includes(post.category || 'none') || (selectedCategories.includes('hot') && post.borderType === 'popular') || (selectedCategories.includes('influencer') && ['gold', 'diamond'].includes(post.borderType || 'none'));
      return matches;
    });
    const uniquePosts = Array.from(new Map(inBoundsCandidates.map(p => [p.id, p])).values());
    setDisplayedMarkers(prev => {
      if (prev.length === uniquePosts.length && prev.every((p, i) => p.id === uniquePosts[i].id)) return prev;
      return uniquePosts;
    });
  }, [mapData?.bounds, timeValue, selectedCategories, allPosts, blockedIds, authUser, currentZoom, displayedMarkers.length]);

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
    setGlobalTrendingPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return { ...post, isLiked, likes: isLiked ? post.likes + 1 : post.likes - 1 };
      }
      return post;
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchGlobalTrending();
    if (mapData?.bounds) {
      const { sw, ne } = mapData.bounds;
      try {
        const dbPosts = await fetchPostsInBounds(sw, ne);
        const mapped = await Promise.all(dbPosts.map(mapDbToPost));
        setAllPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = mapped.filter(p => p && !existingIds.has(p.id));
          const combined = [...newUnique, ...prev];
          mapCache.posts = combined;
          return combined;
        });
      } catch (err) { console.error(err); }
    }
    setIsRefreshing(false);
    showSuccess('데이터를 새로고침했습니다.');
  }, [fetchGlobalTrending, mapData, mapDbToPost]);

  const focusPostOnMap = useCallback((post: Post, center?: { lat: number; lng: number }) => {
    if (post.lat === null || post.lng === null) return;
    setAllPosts((prev) => {
      if (prev.some((item) => item.id === post.id)) return prev;
      const combined = [post, ...prev];
      mapCache.posts = combined;
      return combined;
    });
    setSelectedPostId(null);
    setSearchResultLocation(null);
    setMapCenter(center || { lat: post.lat, lng: post.lng });
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    setHighlightedPostId(post.id);
    highlightTimeoutRef.current = window.setTimeout(() => { setHighlightedPostId(null); highlightTimeoutRef.current = null; }, 4000);
  }, []);

  const handleMarkerClick = useCallback(async (lightPost: Post) => {
    // 1. 먼저 팝업을 띄우기 위해 ID 설정 (이때는 ... 정보일 수 있음)
    setSelectedPostId(lightPost.id);

    // 2. 이미 전체 정보가 있는지 확인 (user.name이 '...'이 아닌 경우)
    if (lightPost.user.name !== '...') return;

    try {
      // 3. 서버에서 해당 포스트의 전체 정보를 가져옴
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', lightPost.id)
        .single();

      if (!error && data) {
        const fullPost = await mapDbToPost(data);
        if (fullPost) {
          // 4. allPosts와 displayedMarkers를 업데이트하여 화면에 즉시 반영
          setAllPosts(prev => prev.map(p => p.id === fullPost.id ? fullPost : p));
          setDisplayedMarkers(prev => prev.map(p => p.id === fullPost.id ? fullPost : p));
        }
      }
    } catch (err) {
      console.error('[Index] Marker detail fetch error:', err);
    }
  }, [mapDbToPost]);

  const handleCurrentLocation = async () => {
    const toastId = showLoading('현재 위치를 찾는 중...');
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      setMapCenter({ lat: latitude, lng: longitude });
      dismissToast(toastId);
      showSuccess('현재 위치로 이동했습니다.');
    } catch (err: any) { dismissToast(toastId); showError('위치 정보를 가져올 수 없습니다.'); }
  };

  useEffect(() => {
    const routeState = location.state as { center?: { lat: number; lng: number }; post?: Post; filterUserId?: string; } | null;
    if (!routeState) return;
    if (routeState.filterUserId === 'me') {
      setSelectedCategories(['mine']);
      // ✅ 내 포스팅 필터 시 줌 레벨 조정 (기존 10에서 6으로 변경 제안 또는 유지)
      setTimeout(() => { setCurrentZoom(6); }, 500);
      if (routeState.post) focusPostOnMap(routeState.post, routeState.center);
      else if (routeState.center) setMapCenter(routeState.center);
      else handleCurrentLocation();
    }
    else if (routeState.post) focusPostOnMap(routeState.post, routeState.center);
    else if (routeState.center) { setSelectedPostId(null); setSearchResultLocation(null); setMapCenter(routeState.center); }
    navigate(location.pathname, { replace: true, state: null });
  }, [focusPostOnMap, location.pathname, location.state, navigate]);

  const handleTrendingPostClick = useCallback((post: Post) => { setIsTrendingExpanded(false); focusPostOnMap(post); }, [focusPostOnMap]);
  const handlePlaceSelect = (place: any) => { setMapCenter({ lat: place.lat, lng: place.lng }); setSearchResultLocation({ lat: place.lat, lng: place.lng }); };
  const handleMapClick = () => { if (searchResultLocation) setSearchResultLocation(null); };

  const handleViewAllClick = useCallback(async () => {
    if (displayedMarkers.length > 0 && currentZoom < 9) {
      console.log('[Index] Opening PostListOverlay and fetching full data');

      const currentIds = displayedMarkers.map(p => p.id);

      try {
        setIsPostListOpen(true);

        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .in('id', currentIds);

        if (!error && data) {
          const mapped = await Promise.all(data.map(p => mapDbToPost(p)));
          const validMapped = mapped.filter(p => p !== null);

          setAllPosts(prev => {
            const postMap = new Map(prev.map(p => [p.id, p]));
            validMapped.forEach(p => {
              // ✅ 기존 데이터와 병합할 때 images 정보가 누락되지 않도록 함
              const existing = postMap.get(p.id);
              postMap.set(p.id, { ...existing, ...p });
            });
            const newList = Array.from(postMap.values());
            mapCache.posts = newList;
            return newList;
          });

          // 4. ✅ [핵심] displayedMarkers 자체를 보강된 데이터로 교체하여
          // PostListOverlay가 리렌더링될 때 확실히 새 데이터를 받게 함
          setDisplayedMarkers(prev => {
            return prev.map(m => {
              const fullData = validMapped.find(f => f.id === m.id);
              return fullData || m;
            });
          });
        }
      } catch (err) {
        console.error('[Index] Failed to fetch full info for list:', err);
      }
    }
  }, [displayedMarkers, currentZoom, mapDbToPost]);

  const handlePostCreated = (newPost: any) => {
    // [FIX] 내가 쓴 글에도 뿅 나타나는 효과를 위해 isNewRealtime 플래그 추가 (MapContainer에서 사용)
    const postWithEffect = { ...newPost, isNewRealtime: true };
    
    setAllPosts(prev => [postWithEffect, ...prev]);
    setDisplayedMarkers(prev => [postWithEffect, ...prev]);
    
    if (newPost.lat && newPost.lng) {
      setMapCenter({ lat: newPost.lat, lng: newPost.lng });
      setCurrentZoom(5);

      // [FIX] 내가 쓴 글 등록 시에도 폭죽 효과 발사
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4F46E5', '#F59E0B', '#10B981', '#EF4444'],
        zIndex: 15000
      });
    }
    setIsWriteOpen(false);
  };

  const handlePostDeleted = useCallback((id: string) => {
    // [FIX] 무한 루프 또는 상태 불일치로 인한 페이지 크래시 방지
    // 1. 선택된 포스트가 삭제되는 경우 즉시 모달/오버레이 상태를 초기화하여 데이터 참조 오류를 차단합니다.
    setSelectedPostId(null);

    // 2. 마커 애니메이션 이벤트를 발생시킵니다. (지도에서만 뿅 사라지게)
    window.dispatchEvent(new CustomEvent('animate-marker-delete', { detail: { id } }));

    // 3. 지연 삭제 처리를 하되, 상태 업데이트가 안정적으로 이루어지도록 함수형 업데이트를 사용합니다.
    // 400ms 애니메이션 시간 후에 실제 데이터 목록에서 제거합니다.
    setTimeout(() => {
      setAllPosts(prev => {
        const filtered = prev.filter(p => p.id !== id);
        mapCache.posts = filtered;
        return filtered;
      });
      
      setDisplayedMarkers(prev => {
        if (!prev) return [];
        return prev.filter(p => p.id !== id);
      });
    }, 400);
  }, []);

  const confirmLocationSelection = () => { if (tempSelectedLocation) { setFinalSelectedLocation(tempSelectedLocation); setIsSelectingLocation(false); setTimeout(() => setIsWriteOpen(true), 100); } };
  const cancelLocationSelection = () => { setIsSelectingLocation(false); setTempSelectedLocation(null); setTimeout(() => setIsWriteOpen(true), 100); };
  const startLocationSelection = () => { setIsWriteOpen(false); setIsPostListOpen(false); setTimeout(() => { setIsSelectingLocation(true); setTempSelectedLocation(mapData?.center || mapCache.lastCenter); }, 500); };

  return (
    <>
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="relative w-full h-screen overflow-hidden bg-gray-50">
        <div className="absolute inset-0 z-0">
          <MapContainer
            posts={displayedMarkers}
            viewedPostIds={viewedIds}
            highlightedPostId={highlightedPostId}
            onMarkerClick={handleMarkerClick}
            onMapChange={handleMapChange}
            onMapClick={handleMapClick}
            center={mapCenter}
            level={currentZoom}
            searchResultLocation={searchResultLocation}
          />
          <AnimatePresence>
            {isSelectingLocation && (
              <>
                <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[50]"><motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative mb-12"><div className="relative w-12 h-12"><div className="absolute top-0 left-0 w-12 h-12 bg-rose-500 rounded-full rounded-br-none rotate-45 border-4 border-white shadow-2xl" /><div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full z-10" /></div><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/20 blur-sm rounded-full" /></motion.div></div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-32 left-0 right-0 px-6 z-[100] flex flex-col gap-4"><div className="bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl border border-indigo-100 flex flex-col items-center gap-3"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" /><p className="text-sm font-black text-gray-900">지도를 움직여 위치를 맞추세요</p></div><div className="flex w-full gap-3"><Button onClick={cancelLocationSelection} variant="secondary" className="flex-1 h-12 rounded-2xl font-bold bg-gray-100 text-gray-600"><X className="w-4 h-4 mr-2" /> 취소</Button><Button onClick={confirmLocationSelection} className="flex-1 h-12 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-100"><Check className="w-4 h-4 mr-2" /> 이 위치로 선택</Button></div></div></motion.div>
              </>
            )}
          </AnimatePresence>
          {!isSelectingLocation && (
            <>
              <AnimatePresence>{isTrendingExpanded && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTrendingExpanded(false)} className="fixed inset-0 bg-transparent z-[35]" />}</AnimatePresence>
              <div className={cn("absolute top-24 left-0 right-0 px-4 flex items-start justify-between pointer-events-none transition-all duration-300", isTrendingExpanded ? "z-40" : "z-10")}><div className="w-full shrink-0 pointer-events-auto"><TrendingPosts posts={globalTrendingPosts} isExpanded={isTrendingExpanded} onToggle={() => setIsTrendingExpanded(!isTrendingExpanded)} onPostClick={handleTrendingPostClick} /></div></div>
              <div className="absolute bottom-32 left-4 z-20 flex flex-col gap-2"><button onClick={() => setIsCategoryOpen(true)} className={cn("w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500", !selectedCategories.includes('all') && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600")}><Layers className="w-6 h-6" /></button><button onClick={() => setIsSearchOpen(true)} className={cn("w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500", isSearchOpen && "ring-2 ring-white ring-offset-2 ring-offset-indigo-600")}><Search className="w-6 h-6" /></button><button onClick={handleCurrentLocation} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-indigo-500"><Navigation className="w-6 h-6 fill-white" /></button></div>
              <div className="absolute bottom-32 right-4 z-20 flex flex-col items-center gap-4">
                <button onClick={handleRefresh} disabled={isRefreshing} className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-indigo-600 shadow-xl active:scale-90 transition-all disabled:opacity-50 border border-indigo-100">
                  <RefreshCw className={cn("w-6 h-6 stroke-[2.5px]", isRefreshing && "animate-spin")} />
                  <span className="text-[9px] font-black mt-1">재검색</span>
                </button>
                <div className="relative">
                  {displayedMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute inset-2 -m-1 bg-indigo-400/30 rounded-[30px] animate-ping pointer-events-none" />
                  )}
                  <button onClick={handleViewAllClick} disabled={displayedMarkers.length === 0 || currentZoom >= 9} className={cn("w-16 h-16 bg-indigo-600 rounded-[24px] flex flex-col items-center justify-center text-white shadow-[0_15px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-all border-2 border-white/20 group overflow-hidden relative", (displayedMarkers.length === 0 || currentZoom >= 9) && "opacity-50 grayscale cursor-not-allowed bg-slate-800/40 border-white/10 shadow-none")}>
                    <LayoutGrid className={cn("w-7 h-7 stroke-[3px] relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")} />
                    <span className={cn("text-[10px] font-black mt-1 relative z-10", (displayedMarkers.length === 0 || currentZoom >= 9) && "text-white/40")}>여기 보기</span>
                  </button>
                  {displayedMarkers.length > 0 && currentZoom < 9 && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300 z-20">{displayedMarkers.length}</div>
                  )}
                </div>
              </div>
              <div className={cn("absolute bottom-6 left-0 right-0 z-10 flex justify-center transition-all duration-500 ease-out", (isTrendingExpanded || isPostListOpen) ? "opacity-0 translate-y-8 pointer-events-none" : "opacity-100 translate-y-0 pointer-events-auto")}><TimeSlider value={timeValue} onChange={setTimeValue} /></div>
            </>
          )}
        </div>
      </motion.div>
      <CategoryMenu isOpen={isCategoryOpen} selectedCategories={selectedCategories} onSelect={setSelectedCategories} onClose={() => setIsCategoryOpen(false)} />
      <AnimatePresence>
        {selectedPostId && (
          <PostDetail
            key="post-detail-modal"
            posts={allPosts}
            initialIndex={allPosts.findIndex(p => p.id === selectedPostId)}
            isOpen={true}
            onClose={() => setSelectedPostId(null)}
            onDelete={handlePostDeleted}
            onViewPost={markAsViewed}
            onLikeToggle={handleLikeToggle}
            onLocationClick={(lat, lng) => { setMapCenter({ lat, lng }); setSelectedPostId(null); }}
          />
        )}
      </AnimatePresence>
      <PlaceSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handlePlaceSelect} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} initialLocation={finalSelectedLocation} onPostCreated={handlePostCreated} onStartLocationSelection={startLocationSelection} onLocationReset={() => setFinalSelectedLocation(null)} />
      <PostListOverlay
        isOpen={isPostListOpen}
        onClose={() => setIsPostListOpen(false)}
        initialPosts={displayedMarkers.map(m => allPosts.find(p => p.id === m.id) || m)}
        mapCenter={mapCenter || { lat: 37.5665, lng: 126.9780 }}
        currentBounds={mapData?.bounds}
        selectedCategories={selectedCategories}
        timeValueHours={timeValue}
        authUserId={authUser?.id}
        onDeletePost={handlePostDeleted}
      />
    </>
  );
};

export default Index;