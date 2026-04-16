import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { App as CapApp } from '@capacitor/app';
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Popular from "./pages/Popular";
import PostList from "./pages/PostList";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import WritePost from "./components/WritePost";
import ExitDialog from "./components/ExitDialog";

const queryClient = new QueryClient();

// 페이지 이동 시 항상 최상단으로 스크롤하는 컴포넌트
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const hideLayout = ["/chat", "/splash"].some(path => location.pathname.startsWith(path));

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const openPopup = document.querySelector('[role="dialog"], [data-vaul-drawer]');
      
      if (openPopup) {
        const closeBtn = document.querySelector('.close-popup-btn') as HTMLElement;
        if (closeBtn) {
          closeBtn.click();
          return;
        }
      }

      if (location.pathname === '/') {
        setShowExitDialog(true);
      } else {
        if (canGoBack) {
          window.history.back();
        } else {
          navigate('/');
        }
      }
    });

    return () => {
      backButtonListener.then(l => l.remove());
    };
  }, [location.pathname, navigate]);

  const handleExitApp = () => {
    CapApp.exitApp();
  };
  
  return (
    <div className="relative min-h-screen bg-white">
      {/* 도메인 확인용 임시 디버그 바 */}
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-black text-white text-[10px] py-1 px-2 text-center font-mono break-all select-all">
        카카오 등록용 도메인: {window.location.origin}
      </div>

      <ScrollToTop />
      {!hideLayout && <Header />}
      
      <main className="relative">
        <AnimatePresence mode="popLayout">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Index />} />
            <Route path="/popular" element={<Popular />} />
            <Route path="/post-list" element={<PostList />} />
            <Route path="/search" element={<Search />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/chat/:chatId" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </main>

      {!hideLayout && (
        <>
          <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
          <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
        </>
      )}

      <ExitDialog 
        isOpen={showExitDialog} 
        onClose={() => setShowExitDialog(false)} 
        onConfirm={handleExitApp} 
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
          <AnimatePresence mode="wait">
            {showSplash ? (
              <SplashScreen key="splash" />
            ) : (
              <AnimatedRoutes key="main-app" />
            )}
          </AnimatePresence>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;