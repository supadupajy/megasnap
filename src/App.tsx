import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { App as CapApp } from '@capacitor/app';

import Index from "./pages/Index";
import Login from "./pages/Login";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { OverlayVisibilityProvider } from "./components/OverlayVisibilityProvider";
import { Loader2 } from "lucide-react";
import { usePushNotifications } from "./hooks/use-push-notifications";
import PlaceSearchOverlay from "./components/PlaceSearchOverlay";
import NotificationsOverlay from "./components/NotificationsOverlay";
import MessagesOverlay from "./components/MessagesOverlay";
import PostSearchOverlay from "./components/PostSearchOverlay";

const Profile = lazy(() => import("./pages/Profile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Follow = lazy(() => import("./pages/Follow"));
const Popular = lazy(() => import("./pages/Popular"));
const Search = lazy(() => import("./pages/Search"));
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
const LogoDownloads = lazy(() => import("./pages/LogoDownloads"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
  </div>
);

const NON_INDEX_ROUTE_PREFIXES = [
  '/login',
  '/auth/',
  '/terms',
  '/privacy-policy',
  '/popular',
  '/nearby-posts',
  '/search',
  '/video-search',
  '/chat',
  '/friends',
  '/profile',
  '/post/',
  '/user-profile',
  '/settings',
  '/write',
  '/flicks',
  '/logo-downloads',
];

const shouldShowIndex = (pathname: string): boolean => {
  if (pathname === '/') return true;
  return !NON_INDEX_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix));
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
  // Flicks 페이지는 전체 풀스크린 영상 뷰어라서, 페이지 wrapper의 기본 흰색이
  // BottomNav 알약 좌/우/위로 비치면 어색해진다 → 이 페이지에선 검정 배경으로 둔다.
  const isFlicksPage = location.pathname.startsWith("/flicks");
  const showIndex = shouldShowIndex(location.pathname);

  const hideAppChrome =
    location.pathname === "/login" ||
    location.pathname === "/splash";

  const hideBottomNav =
    location.pathname === "/login" ||
    location.pathname === "/splash";

  const [isPostListVisible, setIsPostListVisible] = useState(false);
  const [isReelsViewerOpen, setIsReelsViewerOpen] = useState(false);
  const [isAdPostDetailOpen, setIsAdPostDetailOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isPostSearchOpen, setIsPostSearchOpen] = useState(false);

  useEffect(() => {
    if (!showIndex || !session) return;

    const requestMapRelayout = () => {
      window.dispatchEvent(new CustomEvent('map-relayout-request'));
    };

    requestAnimationFrame(requestMapRelayout);
    const timers = [80, 250, 700].map((delay) => window.setTimeout(requestMapRelayout, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [showIndex, session, location.key]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsPostListVisible((window as any).__isPostListOpen === true);
      setIsReelsViewerOpen((window as any).__isReelsViewerOpen === true);
      setIsAdPostDetailOpen((window as any).__isPostDetailAd === true);
      setIsPostSearchOpen((window as any).__isPostSearchOverlayOpen === true);
    }

    const handleOpen = () => setIsPostListVisible(true);
    const handleClose = () => setIsPostListVisible(false);
    const handleReelsOpen = () => setIsReelsViewerOpen(true);
    const handleReelsClose = () => setIsReelsViewerOpen(false);
    const handlePostDetailVisibility = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setIsAdPostDetailOpen(!!detail.open && !!detail.isAd);
    };

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
    const handlePostSearchOpen = () => {
      (window as any).__isPostSearchOverlayOpen = true;
      setIsPostSearchOpen(true);
    };
    const handlePostSearchClose = () => {
      (window as any).__isPostSearchOverlayOpen = false;
      setIsPostSearchOpen(false);
    };

    window.addEventListener('open-post-list-overlay', handleOpen);
    window.addEventListener('close-post-list-overlay', handleClose);
    window.addEventListener('open-reels-viewer', handleReelsOpen);
    window.addEventListener('close-reels-viewer', handleReelsClose);
    window.addEventListener('post-detail-visibility', handlePostDetailVisibility);
    window.addEventListener('open-notifications-overlay', handleNotificationsOpen);
    window.addEventListener('close-notifications-overlay', handleNotificationsClose);
    window.addEventListener('open-messages-overlay', handleMessagesOpen);
    window.addEventListener('close-messages-overlay', handleMessagesClose);
    window.addEventListener('open-post-search-overlay', handlePostSearchOpen);
    window.addEventListener('close-post-search-overlay', handlePostSearchClose);

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
      window.removeEventListener('open-post-search-overlay', handlePostSearchOpen);
      window.removeEventListener('close-post-search-overlay', handlePostSearchClose);
    };
  }, []);

  useEffect(() => {
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showIndex && (window as any).__isTrendingReelsOpen === true) {
      window.dispatchEvent(new CustomEvent('close-trending-reels-by-back'));
    }
  }, [showIndex, location.pathname]);

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if ((window as any).__isPostSearchOverlayOpen === true) {
        if (history.state?.postSearchOverlayOpen) {
          history.back();
        } else {
          window.dispatchEvent(new CustomEvent('close-post-search-overlay'));
        }
        return;
      }

      if ((window as any).__isNotificationsOverlayOpen === true) {
        window.dispatchEvent(new CustomEvent('close-notifications-overlay'));
        return;
      }

      if ((window as any).__isMessagesOverlayOpen === true) {
        window.dispatchEvent(new CustomEvent('close-messages-overlay'));
        return;
      }

      if ((window as any).__isReelsViewerOpen === true) {
        window.dispatchEvent(new CustomEvent('close-reels-viewer-by-back'));
        return;
      }

      if ((window as any).__isTrendingReelsOpen === true) {
        window.dispatchEvent(new CustomEvent('close-trending-reels-by-back'));
        return;
      }

      if ((window as any).__isPlaceSearchOpen === true) {
        window.dispatchEvent(new CustomEvent('close-place-search-by-back'));
        return;
      }

      if (showIndex && (window as any).__isPostDetailOpen === true) {
        window.dispatchEvent(new CustomEvent('close-post-detail-by-back'));
        return;
      }

      if (location.pathname === '/' && (window as any).__isPostListOpen === true) {
        window.dispatchEvent(new CustomEvent('close-post-list-overlay'));
        return;
      }

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
      } else if (canGoBack) {
        window.history.back();
      } else {
        navigate('/');
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [location.pathname, navigate, showIndex]);

  if (loading && location.pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${isFlicksPage ? "bg-black" : "bg-white"} ${isChatPage ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {(!hideAppChrome || isWritePage) && session && !isReelsViewerOpen && !isPostSearchOpen && (
        <Header />
      )}

      <main className={isChatPage ? "h-full" : ""}>
        {session && (
          <div
            aria-hidden={!showIndex}
            style={{ display: showIndex ? 'block' : 'none' }}
            className="w-full"
          >
            <Index />
          </div>
        )}

        {!session && showIndex && location.pathname !== '/login' && (
          <Navigate to="/login" replace />
        )}

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
                  <Route path="/post-search" element={<Navigate to="/" replace />} />
                  <Route path="/video-search" element={<Navigate to="/" replace />} />
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
                  <Route path="/logo-downloads" element={<LogoDownloads />} />
                </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {(!hideBottomNav || isWritePage) && session && !isReelsViewerOpen && !isAdPostDetailOpen && !isPostSearchOpen && <BottomNav />}

      {session && <PlaceSearchOverlay />}

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
          <PostSearchOverlay />
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
              <OverlayVisibilityProvider>
              <div className="min-h-screen w-full bg-white overflow-x-hidden">
                <AnimatePresence mode="wait">
                  {showSplash ? (
                    <SplashScreen key="splash" />
                  ) : (
                    <AnimatedRoutes key="main-app" />
                  )}
                </AnimatePresence>
              </div>
              </OverlayVisibilityProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;