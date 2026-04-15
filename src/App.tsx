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

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // 헤더와 네비게이션을 숨길 경로 설정
  const hideLayout = ["/chat", "/splash"].some(path => location.pathname.startsWith(path));

  useEffect(() => {
    // Capacitor 뒤로가기 버튼 리스너 등록
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/') {
        // 지도 화면(루트)인 경우 종료 팝업 노출
        setShowExitDialog(true);
      } else {
        // 그 외의 경우 뒤로가기 수행
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
    }, 1500);

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