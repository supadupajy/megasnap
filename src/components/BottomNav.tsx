"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MapPin, Flame, UsersRound, User } from 'lucide-react';

// 둥근 모서리 플레이 아이콘 (lucide의 기본 Play는 모서리가 각져있어 직접 정의)
const RoundedPlayIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"

    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* 살짝 안쪽으로 들여 그려 둥근 코너가 자연스럽게 보이도록 함 */}
    <path d="M8.5 5.6c-.5-.3-1.1.1-1.1.7v11.4c0 .6.6 1 1.1.7l9.4-5.7c.5-.3.5-1.1 0-1.4L8.5 5.6z" />
  </svg>
);
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { mapCache } from '@/utils/map-cache';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset';

const navItems: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  iconSizeClass?: string; // 기본 w-6 h-6 외에 따로 키우거나 줄이고 싶을 때 override
}[] = [
  { icon: Flame, label: '인기', path: '/popular' },
  { icon: RoundedPlayIcon, label: 'Flicks', path: '/flicks', iconSizeClass: 'w-7 h-7' },
  { icon: MapPin, label: '지도', path: '/' },
  { icon: UsersRound, label: '친구', path: '/friends' },
  { icon: User, label: '내정보', path: '/profile' },
];

// 하위 경로(예: /settings, /search 등)에 들어갔을 때도 부모 탭이 활성 상태로 유지되도록 매핑
// path 우선순위: 첫 번째로 매치되는 것이 사용됨

// 참고: 포스팅 검색(/post-search)은 더 이상 라우트가 아닌 전역 오버레이로 동작하므로
//       BottomNav 매칭에서 제외되었다. 검색 중에도 현재 탭이 그대로 유지된다.

const subRouteToTab: { match: (pathname: string) => boolean; tabPath: string }[] = [
  // 친구 탭: /friends 하위 경로 + /search (친구 검색)
  { match: (p) => p === '/search' || p.startsWith('/friends'), tabPath: '/friends' },
  // 인기 탭: /popular 하위 경로
  { match: (p) => p.startsWith('/popular'), tabPath: '/popular' },
  // 내정보 탭: /profile, /settings 하위 경로
  { match: (p) => p.startsWith('/profile') || p.startsWith('/settings'), tabPath: '/profile' },
  // Flicks 탭
  { match: (p) => p.startsWith('/flicks'), tabPath: '/flicks' },
];

const PILL_WIDTH = 64;
const PILL_HEIGHT = 60;
const FRIEND_POST_SEEN_KEY_PREFIX = 'chorasnap:friend-posts-seen-at:';
const FRIEND_BADGE_POST_CHECK_LIMIT = 50;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // 키보드가 떠 있는 동안에는 BottomNav를 화면 밖으로 밀어낸다.
  // (안드로이드에서는 position: fixed가 layout viewport 기준이라 키보드 위에 떠 보이기 때문)
  // 댓글 시트가 화면 맨 아래까지 덮고 있으므로 이 슬라이딩은 시트 뒤에서 일어나 사용자에게 보이지 않는다.
  const keyboardOffset = useKeyboardOffset(true);
  const isKeyboardOpen = keyboardOffset > 0;
  const navRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pillLeft, setPillLeft] = useState(0);
  const [ready, setReady] = useState(false);
  const [hasNewFriendPost, setHasNewFriendPost] = useState(false);
  const lastActiveTabIndexRef = useRef(0);

  const isFriendsPage = location.pathname.startsWith('/friends');

  const markFriendPostsSeen = useCallback(() => {
    if (!authUser?.id) return;
    localStorage.setItem(`${FRIEND_POST_SEEN_KEY_PREFIX}${authUser.id}`, new Date().toISOString());
    setHasNewFriendPost(false);
  }, [authUser?.id]);

  useEffect(() => {
    if (isFriendsPage) {
      markFriendPostsSeen();
    }
  }, [isFriendsPage, markFriendPostsSeen]);

  useEffect(() => {
    if (!authUser?.id) {
      setHasNewFriendPost(false);
      return;
    }

    let cancelled = false;
    const seenKey = `${FRIEND_POST_SEEN_KEY_PREFIX}${authUser.id}`;

    const checkFriendPostBadgeOnce = async () => {
      if (isFriendsPage) {
        markFriendPostsSeen();
        return;
      }

      const seenAt = localStorage.getItem(seenKey);

      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', authUser.id);

      if (cancelled) return;

      const followingIds = (followsData || [])
        .map((follow: any) => follow.following_id)
        .filter(Boolean);

      if (followingIds.length === 0) {
        setHasNewFriendPost(false);
        return;
      }

      let postsQuery = supabase
        .from('posts')
        .select('id')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(FRIEND_BADGE_POST_CHECK_LIMIT);

      if (seenAt) {
        postsQuery = postsQuery.gt('created_at', seenAt);
      }

      const { data: recentPosts } = await postsQuery;

      if (cancelled) return;

      const recentPostIds = (recentPosts || []).map((post: any) => post.id).filter(Boolean);
      if (recentPostIds.length === 0) {
        setHasNewFriendPost(false);
        return;
      }

      const { data: viewedRows } = await supabase
        .from('viewed_posts')
        .select('post_id')
        .eq('user_id', authUser.id)
        .in('post_id', recentPostIds);

      if (!cancelled) {
        const viewedPostIds = new Set((viewedRows || []).map((row: any) => row.post_id));
        setHasNewFriendPost(recentPostIds.some((postId: string) => !viewedPostIds.has(postId)));
      }
    };

    checkFriendPostBadgeOnce();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const getTabIndexForPath = (path: string) => {
    const pathname = path.split(/[?#]/)[0] || '/';

    const exact = navItems.findIndex((item) => item.path === pathname);
    if (exact !== -1) return exact;

    const matched = subRouteToTab.find((entry) => entry.match(pathname));
    if (matched) {
      return navItems.findIndex((item) => item.path === matched.tabPath);
    }

    return -1;
  };

  const resolveActiveIndex = () => {
    if (location.pathname === '/notifications' || location.pathname === '/messages') {
      const fromPath = (location.state as any)?.fromPath;
      if (fromPath) {
        const previousTabIndex = getTabIndexForPath(fromPath);
        if (previousTabIndex !== -1) return previousTabIndex;
      }
      return lastActiveTabIndexRef.current;
    }

    return getTabIndexForPath(location.pathname);
  };

  const activeIndex = resolveActiveIndex();
  const safeIndex = activeIndex === -1 ? lastActiveTabIndexRef.current : activeIndex;

  useEffect(() => {
    if (location.pathname === '/notifications' || location.pathname === '/messages') return;
    const currentTabIndex = getTabIndexForPath(location.pathname);
    if (currentTabIndex !== -1) {
      lastActiveTabIndexRef.current = currentTabIndex;
    }
  }, [location.pathname]);

  useEffect(() => {
    const iconEl = iconRefs.current[safeIndex];
    const nav = navRef.current;
    if (iconEl && nav) {
      const navRect = nav.getBoundingClientRect();
      const iconRect = iconEl.getBoundingClientRect();
      setPillLeft(iconRect.left - navRect.left + iconRect.width / 2 - PILL_WIDTH / 2);
      setReady(true);
    }
  }, [safeIndex]);

  const handleNavClick = (path: string) => {
    if (path === '/') {
      if (location.pathname === '/') return;
      mapCache.keepPosition = true;
    }
    navigate(path);
  };

  // 🐛 DEBUG: 키보드 이벤트 추적
  const [kbEvents, setKbEvents] = useState<any[]>([]);
  useEffect(() => {
    const dbg = (window as any).__kbDebug;
    if (!dbg) return;
    const listener = () => setKbEvents([...dbg.events]);
    dbg.listeners.add(listener);
    listener();
    return () => { dbg.listeners.delete(listener); };
  }, []);
  const firstTs = kbEvents[0]?.ts ?? Date.now();

  return (
    <>
      {/* 🐛 DEBUG PANEL — BottomNav 키보드 슬라이딩 디버그 (확인 후 제거) */}
      <div
        className="fixed top-[100px] left-1 right-1 z-[99999] bg-black/85 text-white text-[9px] font-mono p-2 rounded-lg leading-tight pointer-events-none max-h-[60vh] overflow-hidden"
      >
        <div className="font-bold text-yellow-300 mb-1">
          🐛 BOTTOMNAV DEBUG | offset={keyboardOffset} | open={String(isKeyboardOpen)} | transform={isKeyboardOpen ? '120%' : '0'}
        </div>
        <div className="text-cyan-300 mb-1">
          path={location.pathname} | events={kbEvents.length}
        </div>
        <div className="grid grid-cols-[40px_60px_30px_30px_30px_30px_30px_30px_20px_20px_30px] gap-x-1 text-[8px] border-b border-white/20 pb-0.5 mb-0.5 font-bold text-gray-300">
          <span>+ms</span><span>source</span><span>winH</span><span>vpH</span><span>vpTop</span><span>baseH</span><span>layD</span><span>baseD</span><span>shr</span><span>edit</span><span>cmt</span>
        </div>
        {kbEvents.map((e, i) => (
          <div key={i} className="grid grid-cols-[40px_60px_30px_30px_30px_30px_30px_30px_20px_20px_30px] gap-x-1 text-[8px]">
            <span className="text-gray-400">{e.ts - firstTs}</span>
            <span className="text-cyan-200 truncate">{e.source}</span>
            <span>{e.winH}</span>
            <span>{e.vpH}</span>
            <span>{e.vpTop}</span>
            <span className="text-purple-300">{e.baseH}</span>
            <span>{e.layoutDiff}</span>
            <span className="text-purple-300">{e.baseDiff}</span>
            <span className={e.shrunken ? 'text-green-400' : 'text-red-400'}>{e.shrunken ? 'Y' : 'N'}</span>
            <span className={e.editable ? 'text-green-400' : 'text-red-400'}>{e.editable ? 'Y' : 'N'}</span>
            <span className={e.committed > 0 ? 'text-green-400 font-bold' : 'text-gray-400'}>{e.committed}</span>
          </div>
        ))}
      </div>

    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[20000]"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        // 키보드가 올라오면 화면 밖으로 밀어내 키보드 위 노출을 방지.
        // (댓글 시트가 이 영역을 덮고 있으면 사용자에겐 슬라이딩이 보이지 않음)
        transform: isKeyboardOpen ? 'translateY(120%)' : 'translateY(0)',
        transition: 'transform 200ms ease-out',
      }}
    >
      <div ref={navRef} className="relative flex items-center justify-around max-w-lg mx-auto h-16">
        {/* Sliding pill background */}
        {ready && (
          <motion.div
            className={cn(
              'absolute pointer-events-none transition-colors duration-200',
              navItems[safeIndex]?.path === '/' ? 'bg-gray-700' : 'bg-gray-200'
            )}
            style={{ top: '50%', y: '-44%', height: PILL_HEIGHT, width: PILL_WIDTH, borderRadius: 18 }}
            animate={{ left: pillLeft }}
            initial={{ left: pillLeft }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = safeIndex === index;
          const isMainMapTab = item.path === '/';

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className="relative flex flex-col items-center gap-1 min-w-[64px]"
            >
              {/* Icon wrapper */}
              <div
                ref={(el) => { iconRefs.current[index] = el; }}
                className="relative flex items-center justify-center w-[52px] h-9"
              >
                <Icon
                  className={cn(
                    item.iconSizeClass || 'w-6 h-6',
                    'transition-all duration-200',
                    isActive
                      ? isMainMapTab
                        ? 'scale-110 text-orange-400'
                        : 'scale-110 text-gray-900'
                      : 'scale-100 text-gray-400'
                  )}
                />
                {item.path === '/friends' && hasNewFriendPost && !isFriendsPage && (
                  <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white shadow-sm" />
                )}

              </div>
              {/* Label */}
              <span
                className={cn(
                  'relative text-[10px] tracking-tighter leading-none transition-all duration-200',
                  isActive
                    ? isMainMapTab
                      ? 'font-bold text-amber-50'
                      : 'font-bold text-gray-900'
                    : 'font-medium text-gray-400'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}

      </div>
    </nav>
    </>
  );
};

export default BottomNav;