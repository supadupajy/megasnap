import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { App as CapApp } from '@capacitor/app';
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import PostDetail from "./pages/PostDetail";
import UserProfile from "./pages/UserProfile";
import Follow from "./pages/Follow";
import Popular from "./pages/Popular";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import WritePage from "./pages/Write";
import FriendList from "./pages/FriendList";
import FriendFeed from "./pages/FriendFeed";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import PasswordSecurity from "./pages/PasswordSecurity";
import NotificationSettings from "./pages/NotificationSettings";
import LanguageSettings from "./pages/LanguageSettings";
import PrivacySettings from "./pages/PrivacySettings";
import AdInquiry from "./pages/AdInquiry";
import AdminAds from "./pages/AdminAds";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import ExitDialog from "./components/ExitDialog";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { Loader2 } from "lucide-react";
import { usePushNotifications } from "./hooks/use-push-notifications";
import ConnectedAccounts from "./pages/ConnectedAccounts";
import DeviceManagement from "./pages/DeviceManagement";
import Subscription from "./pages/Subscription";
import BillingHistory from "./pages/BillingHistory";
import Notices from "./pages/Notices";
import FAQ from "./pages/FAQ";
import Inquiry from "./pages/Inquiry";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CompanyInfo from "./pages/CompanyInfo";
import AppearanceSettings from "./pages/AppearanceSettings";
import StorageSettings from "./pages/StorageSettings";
import DBImageCompression from "./pages/DBImageCompression";
import DeleteAccount from "./pages/DeleteAccount";
import AuthCallback from "./pages/AuthCallback";
import NearbyPosts from "./pages/NearbyPosts";
import Flicks from "./pages/Flicks";
import PostSearchOverlay from "./components/PostSearchOverlay";
import FriendSearchOverlay from "./components/FriendSearchOverlay";
import PlaceSearchOverlay from "./components/PlaceSearchOverlay";

const queryClient = new QueryClient();

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

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const isChatPage = location.pathname.startsWith("/chat");
  const isWritePage = location.pathname === "/write";

  // App 레벨 Header를 숨길 페이지 (login/splash만)
  const hideAppChrome =
    location.pathname === "/login" ||
    location.pathname === "/splash";

  // BottomNav는 login/splash에서만 숨김 (settings 계열에서는 보여야 함)
  const hideBottomNav =
    location.pathname === "/login" ||
    location.pathname === "/splash";

  // [FIX] PostListOverlay가 닫혀 있을 때는 무조건 BottomNav를 보여주도록 로직 수정
  // [Optimized] setInterval(100ms) 폴링 제거 → open/close 이벤트 기반 동기화
  // (PostListOverlay에서 isOpen 변경 시 open-post-list-overlay/close-post-list-overlay 이벤트 발생)
  const [isPostListVisible, setIsPostListVisible] = useState(false);
  const [isReelsViewerOpen, setIsReelsViewerOpen] = useState(false);
  const [isPostSearchOpen, setIsPostSearchOpen] = useState(false);

  useEffect(() => {
    // 초기값 동기화 (다른 페이지에서 진입 시)
    if (typeof window !== 'undefined') {
      setIsPostListVisible((window as any).__isPostListOpen === true);
      setIsReelsViewerOpen((window as any).__isReelsViewerOpen === true);
      setIsPostSearchOpen((window as any).__isPostSearchOpen === true);
    }

    const handleOpen = () => setIsPostListVisible(true);
    const handleClose = () => setIsPostListVisible(false);
    const handleReelsOpen = () => setIsReelsViewerOpen(true);
    const handleReelsClose = () => setIsReelsViewerOpen(false);
    const handlePostSearchOpen = () => setIsPostSearchOpen(true);
    const handlePostSearchClose = () => setIsPostSearchOpen(false);

    window.addEventListener('open-post-list-overlay', handleOpen);
    window.addEventListener('close-post-list-overlay', handleClose);
    window.addEventListener('open-reels-viewer', handleReelsOpen);
    window.addEventListener('close-reels-viewer', handleReelsClose);
    window.addEventListener('open-post-search', handlePostSearchOpen);
    window.addEventListener('close-post-search', handlePostSearchClose);

    return () => {
      window.removeEventListener('open-post-list-overlay', handleOpen);
      window.removeEventListener('close-post-list-overlay', handleClose);
      window.removeEventListener('open-reels-viewer', handleReelsOpen);
      window.removeEventListener('close-reels-viewer', handleReelsClose);
      window.removeEventListener('open-post-search', handlePostSearchOpen);
      window.removeEventListener('close-post-search', handlePostSearchClose);
    };
  }, []);

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
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

      // 0.3순위: PostSearch 오버레이가 열려 있으면 닫기 (전역 검색 오버레이)
      if ((window as any).__isPostSearchOpen === true) {
        window.dispatchEvent(new CustomEvent('close-post-search'));
        return;
      }

      // 0.5순위: PlaceSearch가 열려 있으면 닫기 (지도 위 최상단 오버레이)
      if ((window as any).__isPlaceSearchOpen === true) {
        window.dispatchEvent(new CustomEvent('close-place-search-by-back'));
        return;
      }

      // 0.6순위: FriendSearch 오버레이가 열려 있으면 닫기
      if ((window as any).__isFriendSearchOpen === true) {
        window.dispatchEvent(new CustomEvent('close-friend-search-by-back'));
        return;
      }

      // 1순위: PostDetail이 열려 있으면 닫기
      if ((window as any).__isPostDetailOpen === true) {
        window.dispatchEvent(new CustomEvent('close-post-detail-by-back'));
        return;
      }

      // 2순위: window 플래그로 PostListOverlay 열림 여부를 즉시 확인 (타이밍 이슈 없음)
      if (location.pathname === '/' && (window as any).__isPostListOpen === true) {
        window.dispatchEvent(new CustomEvent('close-post-list-overlay'));
        return;
      }

      // 3순위: 메인 페이지(지도)인 경우 종료 팝업
      if (location.pathname === '/') {
        setShowExitDialog(true);
      } 
      // 4순위: 그 외 페이지는 이전 페이지로
      else if (canGoBack) {
        window.history.back();
      } 
      // 5순위: 히스토리가 없으면 메인으로
      else {
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

      {(!hideAppChrome || isWritePage) && session && !isReelsViewerOpen && !isPostSearchOpen && (
        <Header />
      )}

      <main className={isChatPage ? "h-full" : ""}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname === '/write' ? '/' : location.pathname}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0 }}
            className={`w-full ${isChatPage ? "h-full overflow-hidden" : ""}`}
          >
            <Routes location={location}>
              <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/popular" element={<ProtectedRoute><Popular /></ProtectedRoute>} />
              <Route path="/nearby-posts" element={<ProtectedRoute><NearbyPosts /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
              {/* /post-search 와 /video-search 는 전역 PostSearchOverlay 로 대체됨.
                  직접 URL 진입 시에는 메인으로 보내고 오버레이를 띄운다. */}
              <Route path="/post-search" element={<Navigate to="/" replace />} />
              <Route path="/video-search" element={<Navigate to="/" replace />} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><FriendFeed /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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
              <Route path="/*" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {(!hideBottomNav || isWritePage) && session && !isReelsViewerOpen && !isPostSearchOpen && <BottomNav />}

      {/* 전역 포스팅 검색 오버레이 — 어디서든 open-post-search 이벤트로 열림 */}
      {session && <PostSearchOverlay />}

      {/* 전역 친구 검색 오버레이 — open-friend-search 이벤트로 열림 */}
      {session && <FriendSearchOverlay />}

      {/* 전역 장소 검색 오버레이 — open-place-search 이벤트로 열림 (detail.onSelect 콜백 전달) */}
      {session && <PlaceSearchOverlay />}

      <ExitDialog
        isOpen={showExitDialog}
        onClose={() => setShowExitDialog(false)}
        onConfirm={() => CapApp.exitApp()}
      />
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