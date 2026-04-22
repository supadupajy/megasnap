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
import UserProfile from "./pages/UserProfile";
import Follow from "./pages/Follow";
import Popular from "./pages/Popular";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import FriendList from "./pages/FriendList";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import ExitDialog from "./components/ExitDialog";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { Loader2 } from "lucide-react";
import { usePushNotifications } from "./hooks/use-push-notifications";
import { initializeYoutubePool } from "./lib/mock-data";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  
  usePushNotifications();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const isChatPage = location.pathname.startsWith("/chat");
  const isFullPage = ["/splash", "/login", "/settings", "/profile/follow"].some(
    path => location.pathname.startsWith(path)
  );

  // 하단 탭 메뉴(메인 메뉴)인지 확인
  const isMainTab = ["/", "/popular", "/search", "/messages", "/profile"].includes(location.pathname);
  const isBackAction = (location.state as any)?.direction === 'back';

  // [FIX] PostListOverlay가 닫혀 있을 때는 무조건 BottomNav를 보여주도록 로직 수정
  const [isPostListVisible, setIsPostListVisible] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      const isOpen = typeof window !== 'undefined' && (window as any).__isPostListOpen === true;
      setIsPostListVisible(isOpen);
    };
    
    // 초기값 동기화
    handleSync();

    // 커스텀 이벤트나 상태 변경 감지를 위한 인터벌 (더 확실한 동기화)
    const interval = setInterval(handleSync, 100);
    window.addEventListener('close-post-list-overlay', () => setIsPostListVisible(false));
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('close-post-list-overlay', () => setIsPostListVisible(false));
    };
  }, []);

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      console.log('[App] Back button pressed. Path:', location.pathname);

      // 1순위: window 플래그로 PostListOverlay 열림 여부를 즉시 확인 (타이밍 이슈 없음)
      if (location.pathname === '/' && (window as any).__isPostListOpen === true) {
        console.log('[App] Intercepting back button to close PostListOverlay');
        window.dispatchEvent(new CustomEvent('close-post-list-overlay'));
        return;
      }

      // 2순위: 메인 페이지(지도)인 경우 종료 팝업
      if (location.pathname === '/') {
        setShowExitDialog(true);
      } 
      // 3순위: 그 외 페이지는 이전 페이지로
      else if (canGoBack) {
        window.history.back();
      } 
      // 4순위: 히스토리가 없으면 메인으로
      else {
        navigate('/');
      }
    });
    return () => { backButtonListener.then(l => l.remove()); };
  // ✅ location.state 의존성 제거 — window 플래그는 클로저로 즉시 읽으므로 의존성 불필요
  }, [location.pathname, navigate]);

  if (loading && location.pathname !== '/login') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`relative bg-white ${isChatPage ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"}`}>
      <AnimatePresence>
        {!isFullPage && session && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <Header />
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`relative ${isChatPage ? "h-full" : ""}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ 
              opacity: 0, 
              x: isMainTab ? 0 : (isBackAction ? -100 : 100),
              scale: isMainTab ? 0.98 : 1
            }}
            animate={{ 
              opacity: 1, 
              x: 0,
              scale: 1
            }}
            exit={{ 
              opacity: 0, 
              x: isMainTab ? 0 : (isBackAction ? 100 : -100),
              scale: isMainTab ? 0.98 : 1
            }}
            transition={{ 
              duration: 0.3,
              ease: [0.32, 0.72, 0, 1] 
            }}
            className={`w-full ${isChatPage ? "h-full overflow-hidden" : ""}`}
          >
            <Routes location={location}>
              <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/popular" element={<ProtectedRoute><Popular /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><FriendList /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
              <Route path="/profile/follow/:userId" element={<ProtectedRoute><Follow /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ✅ [FIX] isPostListVisible 상태를 사용하여 BottomNav 노출 여부 결정 */}
      {!isFullPage && session && !isPostListVisible && <BottomNav />}

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
    initializeYoutubePool();
    // 6초(2.5+@) 동안 스플래시 유지하여 안정적인 로딩 도모
    const timer = setTimeout(() => { 
      setShowSplash(false); 
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <div className="min-h-[100dvh] w-full bg-white overflow-hidden">
              <AnimatePresence mode="wait">
                {showSplash ? (
                  <SplashScreen key="splash" />
                ) : (
                  <AnimatedRoutes key="main-app" />
                )}
              </AnimatePresence>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;