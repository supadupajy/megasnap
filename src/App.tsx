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

const queryClient = new QueryClient();

// 애니메이션 처리를 위한 별도 컴포넌트
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    // initial={false}를 설정하여 첫 렌더링 시 애니메이션을 건너뜁니다.
    <AnimatePresence mode="wait" initial={false}>
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
              <AnimatedRoutes key="routes" />
            )}
          </AnimatePresence>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;