"use client";

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { MapPin, Flame, UsersRound, User } from 'lucide-react';

// 둥근 모서리 플레이 아이콘 (lucide의 기본 Play는 모서리가 각져있어 직접 정의)
const RoundedPlayIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number | string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  path: string;
  iconSizeClass?: string;
}[] = [
  { icon: Flame, label: '인기', path: '/popular' },
  { icon: RoundedPlayIcon, label: 'Flicks', path: '/flicks', iconSizeClass: 'w-6 h-6' },
  { icon: MapPin, label: '지도', path: '/' },
  { icon: UsersRound, label: '친구', path: '/friends' },
  { icon: User, label: '내정보', path: '/profile' },
];

const subRouteToTab: { match: (pathname: string) => boolean; tabPath: string }[] = [
  { match: (p) => p === '/search' || p.startsWith('/friends'), tabPath: '/friends' },
  { match: (p) => p.startsWith('/popular'), tabPath: '/popular' },
  { match: (p) => p.startsWith('/profile') || p.startsWith('/settings'), tabPath: '/profile' },
  { match: (p) => p.startsWith('/flicks'), tabPath: '/flicks' },
];

const FRIEND_POST_SEEN_KEY_PREFIX = 'chorasnap:friend-posts-seen-at:';
const FRIEND_BADGE_POST_CHECK_LIMIT = 50;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const keyboardOffset = useKeyboardOffset(true);
  const isKeyboardOpen = keyboardOffset > 0;
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
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

  // useLayoutEffect로 첫 페인트 전에 위치/너비 계산 → 깜빡임 방지
  useLayoutEffect(() => {
    const updatePillPosition = () => {
      const itemEl = itemRefs.current[safeIndex];
      const nav = navRef.current;
      if (itemEl && nav) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = itemEl.getBoundingClientRect();
        setPillStyle({
          left: itemRect.left - navRect.left,
          width: itemRect.width,
        });
        setReady(true);
      }
    };

    updatePillPosition();
    const rafId = requestAnimationFrame(updatePillPosition);

    const nav = navRef.current;
    if (!nav) {
      return () => cancelAnimationFrame(rafId);
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePillPosition();
    });
    resizeObserver.observe(nav);
    itemRefs.current.forEach((el) => {
      if (el) resizeObserver.observe(el);
    });

    window.addEventListener('resize', updatePillPosition);
    window.addEventListener('orientationchange', updatePillPosition);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePillPosition);
      window.removeEventListener('orientationchange', updatePillPosition);
    };
  }, [safeIndex]);

  const handleNavClick = (path: string) => {
    if (path === '/') {
      if (location.pathname === '/') return;
      mapCache.keepPosition = true;
    }
    navigate(path);
  };

  if (isKeyboardOpen) return null;

  const isMapPillActive = navItems[safeIndex]?.path === '/';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[20000] pointer-events-none"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <nav
        ref={navRef}
        className="pointer-events-auto relative mx-auto flex items-center justify-between max-w-md bg-white rounded-full px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
      >
        {/* Sliding pill background */}
        {ready && (
          <motion.div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 pointer-events-none rounded-full',
              isMapPillActive ? 'map-pill-animated-bg' : 'bg-gray-100'
            )}
            style={{ height: 44 }}
            animate={{ left: pillStyle.left, width: pillStyle.width }}
            initial={{ left: pillStyle.left, width: pillStyle.width }}
            transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
          />
        )}

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = safeIndex === index;
          const isMainMapTab = item.path === '/';

          return (
            <button
              key={item.path}
              ref={(el) => { itemRefs.current[index] = el; }}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                'relative flex items-center justify-center gap-1.5 h-11 rounded-full transition-[padding] duration-300 ease-out',
                isActive ? 'px-3.5 flex-1 min-w-0' : 'px-3 flex-none'
              )}
              aria-label={item.label}
            >
              {/* Icon */}
              <div className="relative flex items-center justify-center shrink-0">
                <Icon
                  className={cn(
                    item.iconSizeClass || 'w-[22px] h-[22px]',
                    'transition-colors duration-200',
                    isActive
                      ? isMainMapTab
                        ? 'text-yellow-400'
                        : 'text-gray-900'
                      : 'text-gray-400'
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {item.path === '/friends' && hasNewFriendPost && !isFriendsPage && (
                  <span
                    aria-label="새 친구 포스팅"
                    className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-white shadow-[0_2px_6px_rgba(234,179,8,0.55)]"
                  />
                )}
              </div>

              {/* Label - 활성 탭에서만 노출 (가로 슬라이드) */}
              <motion.span
                initial={false}
                animate={{
                  width: isActive ? 'auto' : 0,
                  opacity: isActive ? 1 : 0,
                  marginLeft: isActive ? 0 : -2,
                }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'relative overflow-hidden whitespace-nowrap text-[13px] leading-none font-bold tracking-tight',
                  isMainMapTab ? 'text-amber-50' : 'text-gray-900'
                )}
              >
                {item.label}
              </motion.span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
