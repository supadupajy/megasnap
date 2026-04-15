import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
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

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  
  // 헤더와 네비게이션을 숨길 경로 설정
  const hideLayout = ["/chat", "/splash"].some(path => location.pathname.startsWith(path));
  
  return (
    <div className="relative min-h-screen bg-white">
      {!hideLayout && <Header />}
      
      <main className="relative">
        {/* popLayout 모드를 사용하여 페이지가 겹치며 전환되도록 설정 */}
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