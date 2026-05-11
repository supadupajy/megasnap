"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Map, Flame, PlusCircle, UsersRound, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { mapCache } from '@/utils/map-cache';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset';

const navItems = [
  { icon: Map, label: '지도', path: '/' },
  { icon: Flame, label: '인기', path: '/popular' },
  { icon: PlusCircle, label: '업로드', path: '/write' },
  { icon: UsersRound, label: '친구', path: '/friends' },
  { icon: User, label: '내정보', path: '/profile' },
];

// 하위 경로(예: /settings, /search 등)에 들어갔을 때도 부모 탭이 활성 상태로 유지되도록 매핑
// path 우선순위: 첫 번째로 매치되는 것이 사용됨
const subRouteToTab: { match: (pathname: string) => boolean; tabPath: string }[] = [
  // 친구 탭: /friends 하위 경로 + /search (친구 검색)
  { match: (p) => p === '/search' || p.startsWith('/friends'), tabPath: '/friends' },
  // 인기 탭: /popular 하위 경로 + /post-search (포스팅 검색)
  { match: (p) => p === '/post-search' || p === '/video-search' || p.startsWith('/popular'), tabPath: '/popular' },
  // 내정보 탭: /profile, /settings 하위 경로
  { match: (p) => p.startsWith('/profile') || p.startsWith('/settings'), tabPath: '/profile' },
  // 업로드 탭
  { match: (p) => p.startsWith('/write'), tabPath: '/write' },
];

const PILL_WIDTH = 64;
const PILL_HEIGHT = 60;
const FRIEND_POST_SEEN_KEY_PREFIX = 'chorasnap:friend-posts-seen-at:';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pillLeft, setPillLeft] = useState(0);
  const [ready, setReady] = useState(false);
  const [hasNewFriendPost, setHasNewFriendPost] = useState(false);
  const [isCommentsDialogClosing, setIsCommentsDialogClosing] = useState(false);
  const keyboardOffset = useKeyboardOffset();
  const lastActiveTabIndexRef = useRef(0);

  const isFriendsPage = location.pathname.startsWith('/friends');

  useEffect(() => {
    const handleCommentsDialogVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean; closing?: boolean }>).detail;
      // 댓글창이 "닫힘 애니메이션 중"일 때만 BottomNav가 잠깐 깜빡 보였다 사라지는
      // 현상을 방지하기 위해 숨겨둔다. 그 외(열려 있고 키보드 미표시 등)에서는
      // BottomNav 표시 여부를 키보드 offset에만 맡긴다.
      setIsCommentsDialogClosing(!!detail?.open && !!detail.closing);
    };

    window.addEventListener('comments-dialog-visibility', handleCommentsDialogVisibility);
    return () => window.removeEventListener('comments-dialog-visibility', handleCommentsDialogVisibility);
  }, []);

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

      const seenAt = localStorage.getItem(seenKey) || '1970-01-01T00:00:00.000Z';

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

      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id')
        .in('user_id', followingIds)
        .gt('created_at', seenAt)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!cancelled) {
        setHasNewFriendPost((recentPosts?.length ?? 0) > 0);
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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[20000] will-change-transform"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        // 키보드가 떠 있거나 댓글창이 닫히는 중일 때는 BottomNav를 숨긴다.
        // - 닫힘 애니메이션 중에는 키보드가 먼저 내려가도 BottomNav가 잠깐 깜빡 보였다 사라지는 현상을 막기 위함.
        visibility: keyboardOffset > 0 || isCommentsDialogClosing ? 'hidden' : 'visible',
        transform: keyboardOffset > 0 ? `translate3d(0, ${keyboardOffset}px, 0)` : 'translate3d(0, 0, 0)',
        // 키보드 offset 자체가 중간값을 흘리지 않고 0 또는 키보드높이로만 바뀌므로
        // 슬라이딩 전환이 보이지 않게 하려면 transition을 항상 꺼두는 것이 안전하다.
        transition: 'none',
      }}
    >
      <div ref={navRef} className="relative flex items-center justify-around max-w-lg mx-auto h-16">
        {/* Sliding pill background */}
        {ready && (
          <motion.div
            className="absolute bg-gray-200 pointer-events-none"
            style={{ top: '50%', y: '-44%', height: PILL_HEIGHT, width: PILL_WIDTH, borderRadius: 18 }}
            animate={{ left: pillLeft }}
            initial={{ left: pillLeft }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = safeIndex === index;

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
                    'w-6 h-6 transition-all duration-200',
                    isActive ? 'scale-110 text-gray-900' : 'scale-100 text-gray-400'
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
                  isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-400'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;