import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { App as CapApp } from '@capacitor/app';

// ─────────────────────────────────────────────────────────────
// [Optimized] 라우트 코드 스플리팅
// Index/Login만 즉시 import, 나머지는 lazy 로딩으로 초기 번들 크기를 크게 줄임.
// 카카오맵/leaflet/mapbox 같은 무거운 라이브러리들이 첫 진입에 함께 번들되던 문제 해결.
// ─────────────────────────────────────────────────────────────
import Index from "./pages/Index";
import Login from "./pages/Login";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { Loader2 } from "lucide-react";
import { usePushNotifications } from "./hooks/use-push-notifications";
import PlaceSearchOverlay from "./components/PlaceSearchOverlay";
import NotificationsOverlay from "./components/NotificationsOverlay";
import MessagesOverlay from "./components/MessagesOverlay";

// Lazy-loaded routes (초기 로드 후 필요할 때만 fetch)
const Profile = lazy(() => import("./pages/Profile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Follow = lazy(() => import("./pages/Follow"));
const Popular = lazy(() => import("./pages/Popular"));
const Search = lazy(() => import("./pages/Search"));
// Notifications / Messages는 더 이상 라우트가 아니라 전역 오버레이로 마운트된다.
// (해당 페이지로 라우트 이동을 하지 않으므로 아래 페이지(예: Flicks)의 영상/상태가
//  그대로 유지된다 → 깜빡임/이어 재생 캐시 등 우회 코드 불필요)
const Chat = lazy(() => import("./pages/Chat"));
const WritePage = lazy(() => import("./pages/Write"));
const FriendList = lazy(() => import("./pages/FriendList"));
const FriendFeed = lazy(() => import("./pages/FriendFeed"));
const Settings = lazy(() => import("./pages/Settings"));
const PasswordSecurity = lazy(() => import("./pages/PasswordSecurity"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const LanguageSettings = lazy(() => import("./pages/LanguageSettings"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const AdInquiry = lazy(() => import("./pages/AdInquiry"));
const AdminAds = lazy(() => import("./pages/AdminAds"));
const ConnectedAccounts = lazy(() => import("./pages/ConnectedAccounts"));
const DeviceManagement = lazy(() => import("./pages/DeviceManagement"));
const Subscription = lazy(() => import("./pages/Subscription"));
const BillingHistory = lazy(() => import("./pages/BillingHistory"));
const Notices = lazy(() => import("./pages/Notices"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Inquiry = lazy(() => import("./pages/Inquiry"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CompanyInfo = lazy(() => import("./pages/CompanyInfo"));
const AppearanceSettings = lazy(() => import("./pages/AppearanceSettings"));
const StorageSettings = lazy(() => import("./pages/StorageSettings"));
const DBImageCompression = lazy(() => import("./pages/DBImageCompression"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NearbyPosts = lazy(() => import("./pages/NearbyPosts"));
const Flicks = lazy(() => import("./pages/Flicks"));
const PostSearch = lazy(() => import("./pages/PostSearch"));
const NaverTest = lazy(() => import("./pages/NaverTest"));

// React Query 기본 설정 강화 (불필요한 refetch 줄이기)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1분간은 캐시를 fresh로 간주
      gcTime: 5 * 60 * 1000,        // 5분간 메모리에 보관
      refetchOnWindowFocus: false,  // 창 포커스 시 자동 refetch 비활성
      retry: 1,                     // 실패 시 1회만 재시도
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
  </div>
);

// ─────────────────────────────────────────────────────────────
// Index 페이지(지도)를 라우트 밖에 항상 마운트해 두고, 다른 라우트로
// 이동해도 unmount되지 않도록 한다. 이렇게 하면 지도 인스턴스/마커/
// 고스트 마커/카메라 위치/실시간 인기 패널이 그대로 유지되어
// 탭 전환 시 재로딩이나 마커 entrance 애니메이션 재생이 일어나지 않는다.
//
// 명시된 다른 라우트 prefix들은 아래 목록으로 관리하며, 그 외 경로는
// Index가 표시되어야 한다 (기존 catch-all 라우트 동작과 동일).
// ─────────────────────────────────────────────────────────────
const NON_INDEX_ROUTE_PREFIXES = [
  '/login',
  '/auth/',
  '/terms',
  '/privacy-policy',
  '/popular',
  '/nearby-posts',
  '/search',
  '/post-search',
  '/video-search',
  // '/notifications', '/messages'는 오버레이로 처리하므로 라우트 prefix가 아님.
  '/chat',
  '/friends',
  '/profile',
  '/post/',
  '/user-profile',
  '/settings',
  '/write',
  '/flicks',
  '/naver-test',
];

const shouldShowIndex = (pathname: string): boolean => {
  if (pathname === '/') return true;
  return !NON_INDEX_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const PushNotificationBootstrap = () => {
  usePushNotifications();
  return null;
};

// 외부에서 /notifications 또는 /messages URL로 직접 진입한 경우 홈으로 보내고
// 해당 오버레이를 자동으로 열어 준다 (푸시 알림 클릭, 딥링크 등).
const OverlayRouteRedirect: React.FC<{ overlay: 'notifications' | 'messages' }> = ({ overlay }) => {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(`open-${overlay}-overlay`));
  }, [overlay]);
  return <Navigate to="/" replace />;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const lastBackPressRef = useRef<number>(0);

  const isChatPage = location.pathname.startsWith("/chat");
  const isWritePage = location.pathname === "/write";
  const showIndex = shouldShowIndex(location.pathname);

  // App 레벨 Header를 숨길 페이지 (login/splash/naver-test)
  const hideAppChrome =
    location.pathname === "/login" ||
    location.pathname === "/splash" ||
    location.pathname === "/naver-test";

  // BottomNav는 login/splash/naver-test에서 숨김
  const hideBottomNav =
    location.pathname === "/login" ||
    location.pathname === "/splash" ||
    location.pathname === "/naver-test";

  // [FIX] PostListOverlay가 닫혀 있을 때는 무조건 BottomNav를 보여주도록 로직 수정
  // [Optimized] setInterval(100ms) 폴링 제거 → open/close 이벤트 기반 동기화
  // (PostListOverlay에서 isOpen 변경 시 open-post-list-overlay/close-post-list-overlay 이벤트 발생)
  const [isPostListVisible, setIsPostListVisible] = useState(false);
  const [isReelsViewerOpen, setIsReelsViewerOpen] = useState(false);
  // 광고 PostDetail이 열려 있을 때는 BottomNav 숨김 (X 버튼으로만 닫음)
  const [isAdPostDetailOpen, setIsAdPostDetailOpen] = useState(false);
  // 알림/메시지 전역 오버레이 열림 상태.
  // - 라우트가 아니므로 페이지(예: Flicks)는 그대로 살아 있고 그 위에 오버레이만 덮인다.
  // - 하단 메뉴(BottomNav) 탭이나 다른 라우트로 이동하면 자동으로 닫힌다.
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);

  useEffect(() => {
    if (!showIndex || !session) return;

    const requestMapRelayout = () => {
      window.dispatchEvent(new CustomEvent('map-relayout-request'));
    };

    requestAnimationFrame(requestMapRelayout);
    const timers = [80, 250, 700].map(delay => window.setTimeout(requestMapRelayout, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [showIndex, session, location.key]);

  useEffect(() => {
    // 초기값 동기화 (다른 페이지에서 진입 시)
    if (typeof window !== 'undefined') {
      setIsPostListVisible((window as any).__isPostListOpen === true);
      setIsReelsViewerOpen((window as any).__isReelsViewerOpen === true);
      setIsAdPostDetailOpen((window as any).__isPostDetailAd === true);
    }

    const handleOpen = () => setIsPostListVisible(true);
    const handleClose = () => setIsPostListVisible(false);
    const handleReelsOpen = () => setIsReelsViewerOpen(true);
    const handleReelsClose = () => setIsReelsViewerOpen(false);
    const handlePostDetailVisibility = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setIsAdPostDetailOpen(!!detail.open && !!detail.isAd);
    };

    // 알림/메시지 오버레이는 mutually exclusive:
    // 한쪽이 열려 있을 때 다른 쪽을 열려고 하면 먼저 열려 있던 것을 닫고 새 것을 연다.
    // 이렇게 하면 두 오버레이가 동시에 떠 있는 상태가 생기지 않으므로 z-index/플래그 꼬임이 없다.
    const handleNotificationsOpen = () => {
      setIsMessagesOpen(false);
      setIsNotificationsOpen(true);
    };
    const handleNotificationsClose = () => setIsNotificationsOpen(false);
    const handleMessagesOpen = () => {
      setIsNotificationsOpen(false);
      setIsMessagesOpen(true);
    };
    const handleMessagesClose = () => setIsMessagesOpen(false);

    window.addEventListener('open-post-list-overlay', handleOpen);
    window.addEventListener('close-post-list-overlay', handleClose);
    window.addEventListener('open-reels-viewer', handleReelsOpen);
    window.addEventListener('close-reels-viewer', handleReelsClose);
    window.addEventListener('post-detail-visibility', handlePostDetailVisibility);
    window.addEventListener('open-notifications-overlay', handleNotificationsOpen);
    window.addEventListener('close-notifications-overlay', handleNotificationsClose);
    window.addEventListener('open-messages-overlay', handleMessagesOpen);
    window.addEventListener('close-messages-overlay', handleMessagesClose);

    return () => {
      window.removeEventListener('open-post-list-overlay', handleOpen);
      window.removeEventListener('close-post-list-overlay', handleClose);
      window.removeEventListener('open-reels-viewer', handleReelsOpen);
      window.removeEventListener('close-reels-viewer', handleReelsClose);
      window.removeEventListener('post-detail-visibility', handlePostDetailVisibility);
      window.removeEventListener('open-notifications-overlay', handleNotificationsOpen);
      window.removeEventListener('close-notifications-overlay', handleNotificationsClose);
      window.removeEventListener('open-messages-overlay', handleMessagesOpen);
      window.removeEventListener('close-messages-overlay', handleMessagesClose);
    };
  }, []);

  // 라우트(pathname)가 바뀌면 알림/메시지 오버레이는 자동으로 닫는다.
  // - BottomNav 탭 클릭(다른 라우트로 이동)
  // - Notifications/Messages 내부에서 프로필/채팅/포스트로 이동
  // - 푸시 알림으로 들어와 OverlayRouteRedirect가 / 로 보낸 직후의 이전 path 잔여 등
  //   어느 경우든 라우트가 변하면 오버레이는 닫혀야 자연스럽다.
  useEffect(() => {
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
    // 의도적으로 location.pathname만 의존성에 둔다 (오버레이 자체 상태 변경으로는 재실행 X)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!showIndex && (window as any).__isTrendingReelsOpen === true) {
      window.dispatchEvent(new CustomEvent('close-trending-reels-by-back'));
    }
  }, [showIndex, location.pathname]);

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      console.log('[TagSearchDebug][AppBack] backButton', {
        pathname: location.pathname,
        showIndex,
        canGoBack,
        historyState: history.state,
        postDetailOpen: (window as any).__isPostDetailOpen,
        returnToPostDetail: sessionStorage.getItem('postSearch_returnToPostDetail'),
      });

      // 0순위(최상): 알림/메시지 전역 오버레이가 떠 있으면 그것부터 닫기
      if ((window as any).__isNotificationsOverlayOpen === true) {
        console.log('[TagSearchDebug][AppBack] close notifications overlay');
        window.dispatchEvent(new CustomEvent('close-notifications-overlay'));
        return;
      }
      if ((window as any).__isMessagesOverlayOpen === true) {
        window.dispatchEvent(new CustomEvent('close-messages-overlay'));
        return;
      }

      // 0순위: ReelsViewer가 열려 있으면 닫기 (최상단 풀스크린 오버레이)
      if ((window as any).__isReelsViewerOpen === true) {
        window.dispatchEvent(new CustomEvent('close-reels-viewer-by-back'));
        return;
      }

      // 0.1순위: 트렌딩 릴스(인덱스 페이지의 임베디드 ReelsViewer)가 열려 있으면 닫기
      if ((window as any).__isTrendingReelsOpen === true) {
        window.dispatchEvent(new CustomEvent('close-trending-reels-by-back'));
        return;
      }

      // 0.5순위: PlaceSearch가 열려 있으면 닫기 (지도 위 최상단 오버레이)
      if ((window as any).__isPlaceSearchOpen === true) {
        window.dispatchEvent(new CustomEvent('close-place-search-by-back'));
        return;
      }

      // 1순위: PostDetail이 실제로 보이는 지도 화면에서만 닫기.
      // /post-search 같은 다른 라우트에서는 Index 안의 PostDetail이 display:none으로 숨겨져 있을 뿐
      // 플래그는 true로 남아 있을 수 있다. 이때 PostDetail을 먼저 닫으면
      // "지도마커 상세 → 태그 검색 → 뒤로가기 → 지도마커 상세" 흐름이 깨진다.
      if (showIndex && (window as any).__isPostDetailOpen === true) {
        console.log('[TagSearchDebug][AppBack] close visible PostDetail');
        window.dispatchEvent(new CustomEvent('close-post-detail-by-back'));
        return;
      }

      // 2순위: window 플래그로 PostListOverlay 열림 여부를 즉시 확인 (타이밍 이슈 없음)
      if (location.pathname === '/' && (window as any).__isPostListOpen === true) {
        console.log('[TagSearchDebug][AppBack] close post list overlay');
        window.dispatchEvent(new CustomEvent('close-post-list-overlay'));
        return;
      }

      // 3순위: 메인 페이지(지도)인 경우 종료 안내 토스트 (두 번 누르면 종료)
      if (location.pathname === '/') {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressRef.current = now;
          toast("종료하시려면 한번 더 뒤로가기 버튼을 눌러주세요.", {
            duration: 2000,
          });
        }
      } 
      // 4순위: 그 외 페이지는 이전 페이지로
      else if (canGoBack) {
        console.log('[TagSearchDebug][AppBack] history.back()', {
          pathname: location.pathname,
          historyState: history.state,
        });
        window.history.back();
      }
      // 5순위: 히스토리가 없으면 메인으로
      else {
        console.log('[TagSearchDebug][AppBack] navigate home fallback');
        navigate('/');
      }
    });
    return () => { backButtonListener.then(l => l.remove()); };
  // ✅ location.state 의존성 제거 — window 플래그는 클로저로 즉시 읽으므로 의존성 불필요
  }, [location.pathname, navigate]);

  if (loading && location.pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`bg-white ${isChatPage ? "h-screen overflow-hidden" : "min-h-screen"}`}>

      {/* Header: hideAppChrome이 아닐 때 또는 write 페이지일 때 표시 */}
      {/* ReelsViewer 또는 PostSearch 오버레이 열림 시에는 항상 숨김 */}

      {(!hideAppChrome || isWritePage) && session && !isReelsViewerOpen && (
        <Header />
      )}

      <main className={isChatPage ? "h-full" : ""}>
        {/* Persistent Index: 한 번 마운트되면 다른 라우트로 가도 unmount되지 않고
            CSS로만 숨겨진다. 지도/마커/고스트 마커가 그대로 메모리에 유지된다.
            세션이 있을 때만 마운트 (비세션 시에는 /login으로 redirect 됨). */}
        {session && (
          <div
            aria-hidden={!showIndex}
            style={{ display: showIndex ? 'block' : 'none' }}
            className="w-full"
          >
            <Index />
          </div>
        )}

        {/* 비세션 상태에서 Index가 보여야 하는 경로로 진입한 경우 /login으로 보냄 */}
        {!session && showIndex && location.pathname !== '/login' && (
          <Navigate to="/login" replace />
        )}

        {/* 그 외 라우트들. showIndex이고 session이 있을 때는 Routes를 렌더하지 않아
            지도 위에 겹치지 않게 한다. */}
        {(!showIndex || !session) && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={location.pathname === '/write' ? '/' : location.pathname}
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
              className={`w-full ${isChatPage ? "h-full overflow-hidden" : ""}`}
            >
              <Suspense fallback={<RouteFallback />}>
                <Routes location={location}>
                  <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/terms" element={<TermsOfService fromSignup />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy fromSignup />} />
                  <Route path="/popular" element={<ProtectedRoute><Popular /></ProtectedRoute>} />
                  <Route path="/nearby-posts" element={<ProtectedRoute><NearbyPosts /></ProtectedRoute>} />
                  <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                  <Route path="/post-search" element={<ProtectedRoute><PostSearch /></ProtectedRoute>} />
                  <Route path="/video-search" element={<Navigate to="/post-search" replace />} />
                  {/* /notifications, /messages는 더 이상 라우트가 아니다 (전역 오버레이로 동작).
                      외부에서 해당 URL로 진입한 경우에 대비해 홈으로 리다이렉트하면서
                      자동으로 해당 오버레이를 띄운다. */}
                  <Route path="/notifications" element={<OverlayRouteRedirect overlay="notifications" />} />
                  <Route path="/messages" element={<OverlayRouteRedirect overlay="messages" />} />
                  <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/friends" element={<ProtectedRoute><FriendFeed /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                  <Route path="/post/:id" element={<PostDetail />} />
                  <Route path="/profile/follow/:userId" element={<Follow />} />
                  <Route path="/profile/friends" element={<FriendList />} />
                  <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                  <Route path="/user-profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/settings/password" element={<ProtectedRoute><PasswordSecurity /></ProtectedRoute>} />
                  <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                  <Route path="/settings/language" element={<ProtectedRoute><LanguageSettings /></ProtectedRoute>} />
                  <Route path="/settings/privacy" element={<ProtectedRoute><PrivacySettings /></ProtectedRoute>} />
                  <Route path="/settings/ad" element={<ProtectedRoute><AdInquiry /></ProtectedRoute>} />
                  <Route path="/settings/admin-ads" element={<ProtectedRoute><AdminAds /></ProtectedRoute>} />
                  <Route path="/settings/connected-accounts" element={<ProtectedRoute><ConnectedAccounts /></ProtectedRoute>} />
                  <Route path="/settings/devices" element={<ProtectedRoute><DeviceManagement /></ProtectedRoute>} />
                  <Route path="/settings/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
                  <Route path="/settings/billing" element={<ProtectedRoute><BillingHistory /></ProtectedRoute>} />
                  <Route path="/settings/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
                  <Route path="/settings/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
                  <Route path="/settings/inquiry" element={<ProtectedRoute><Inquiry /></ProtectedRoute>} />
                  <Route path="/settings/privacy-policy" element={<ProtectedRoute><PrivacyPolicy /></ProtectedRoute>} />
                  <Route path="/settings/terms" element={<ProtectedRoute><TermsOfService /></ProtectedRoute>} />
                  <Route path="/settings/company-info" element={<ProtectedRoute><CompanyInfo /></ProtectedRoute>} />
                  <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
                  <Route path="/settings/storage" element={<ProtectedRoute><StorageSettings /></ProtectedRoute>} />
                  <Route path="/settings/db-image-compression" element={<ProtectedRoute><DBImageCompression /></ProtectedRoute>} />
                  <Route path="/settings/delete-account" element={<ProtectedRoute><DeleteAccount /></ProtectedRoute>} />
                  <Route path="/write" element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
                  <Route path="/flicks" element={<ProtectedRoute><Flicks /></ProtectedRoute>} />
                  <Route path="/naver-test" element={<NaverTest />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {(!hideBottomNav || isWritePage) && session && !isReelsViewerOpen && !isAdPostDetailOpen && <BottomNav />}

      {/* 전역 장소 검색 오버레이 — open-place-search 이벤트로 열림 (detail.onSelect 콜백 전달) */}
      {session && <PlaceSearchOverlay />}

      {/* 전역 알림/메시지 오버레이 — 라우트와 무관하게 현재 페이지 위로 덮인다.
          Flicks/Index/Profile 등 어디서든 열릴 수 있고, 닫으면 그 페이지가 그대로 이어진다. */}
      {session && (
        <>
          <NotificationsOverlay
            open={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
          />
          <MessagesOverlay
            open={isMessagesOpen}
            onClose={() => setIsMessagesOpen(false)}
          />
        </>
      )}

    </div>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PushNotificationBootstrap />
            <NotificationProvider>
            <div className="min-h-screen w-full bg-white overflow-x-hidden">
              <AnimatePresence mode="wait">

                {showSplash ? (
                  <SplashScreen key="splash" />
                ) : (
                  <AnimatedRoutes key="main-app" />
                )}
              </AnimatePresence>
            </div>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;