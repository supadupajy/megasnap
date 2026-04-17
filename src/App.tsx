import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { App as CapApp } from '@capacitor/app';
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Popular from "./pages/Popular";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import WritePost from "./components/WritePost";
import ExitDialog from "./components/ExitDialog";
import NicknameDialog from "./components/NicknameDialog";
import { AuthProvider, useAuth } from "./components/AuthProvider";

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
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, user, profile, refreshProfile } = useAuth();
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  
  const hideLayout = ["/chat", "/splash", "/login", "/settings"].some(path => location.pathname.startsWith(path));

  useEffect(() => {
    if (session && profile && !profile.nickname && !hideLayout) {
      setShowNicknameDialog(true);
    } else {
      setShowNicknameDialog(false);
    }
  }, [session, profile, hideLayout]);

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
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/popular" element={<ProtectedRoute><Popular /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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

      {user && (
        <NicknameDialog 
          isOpen={showNicknameDialog} 
          userId={user.id} 
          onComplete={() => {
            setShowNicknameDialog(false);
            refreshProfile();
          }} 
        />
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