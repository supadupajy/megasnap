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
  const isFullPage = ["/chat", "/splash", "/login", "/settings", "/friends", "/profile/follow", "/messages", "/notifications"].some(
    path => location.pathname.startsWith(path)
  );

  // 경로별 우선순위 정의 (왼쪽 탭일수록 낮은 숫자)
  const getPathPriority = (pathname: string) => {
    if (pathname === '/') return 0;          // 지도
    if (pathname === '/popular') return 1;   // 인기
    if (pathname === '/search') return 2;    // 검색/친구
    if (pathname === '/profile') return 3;   // 내 정보
    return 5; // 기타 페이지
  };

  // 이전 경로와 현재 경로의 우선순위 비교하여 방향 결정
  const [prevPath, setPrevPath] = useState(location.pathname);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  useEffect(() => {
    const prevPriority = getPathPriority(prevPath);
    const currPriority = getPathPriority(location.pathname);

    // 명시적인 back direction state가 있으면 그것을 우선시함
    if ((location.state as any)?.direction === 'back') {
      setDirection('back');
    } else if (prevPriority > currPriority) {
      setDirection('back');
    } else {
      setDirection('forward');
    }
    
    setPrevPath(location.pathname);
  }, [location.pathname, location.state]);

  const isBackAction = direction === 'back';

  // 지도 페이지에서 특정 오버레이가 열렸을 때 Nav를 숨기기 위한 상태 감지
  const isPostListOpen = location.pathname === '/' && (location.state as any)?.isPostListOpen;

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/') {
        setShowExitDialog(true);
      } else if (canGoBack) {
        window.history.back();
      } else {
        navigate('/');
      }
    });
    return () => { backButtonListener.then(l => l.remove()); };
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
              x: isBackAction ? -100 : 100
            }}
            animate={{
              opacity: 1,
              x: 0
            }}
            exit={{
              opacity: 0,
              x: isBackAction ? 100 : -100
            }}
            transition={{ 
              duration: 0.35,
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

      {/* BottomNav를 AnimatePresence 바깥으로 이동하여 항상 고정 */}
      {!isFullPage && session && !isPostListOpen && <BottomNav />}

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
    }, 6000);
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