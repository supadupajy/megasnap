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
import WritePost from "./components/WritePost";
import ExitDialog from "./components/ExitDialog";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // 인증 확인이 5초 이상 걸리면 강제로 로그인 페이지로 이동
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setTimedOut(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }
  
  if (!session || timedOut) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const hideLayout = ["/chat", "/splash", "/login", "/settings", "/friends"].some(path => location.pathname.startsWith(path));

  useEffect(() => {
    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const openPopup = document.querySelector('[role="dialog"], [data-vaul-drawer], .close-popup-btn');
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
      <ScrollToTop />
      {!hideLayout && session && <Header />}
      
      <main className="relative">
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
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
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideLayout && session && (
        <>
          <BottomNav onWriteClick={() => setIsWriteOpen(prev => !prev)} />
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
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatePresence mode="wait">
              {showSplash ? (
                <SplashScreen key="splash" />
              ) : (
                <AnimatedRoutes key="main-app" />
              )}
            </AnimatePresence>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;