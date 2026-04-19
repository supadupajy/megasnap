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
import ExitDialog from "./components/ExitDialog";
import KeyboardSimulator from "./components/KeyboardSimulator";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { Loader2 } from "lucide-react";
import { usePushNotifications } from "./hooks/use-push-notifications";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  
  usePushNotifications();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
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
  
  const hideLayout = ["/chat", "/splash", "/login", "/settings", "/friends"].some(path => location.pathname.startsWith(path));

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
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-full bg-white overflow-hidden">
      {!hideLayout && session && <Header />}
      
      <main className="h-full relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full"
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
              <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></UserProfile>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

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
    const timer = setTimeout(() => { setShowSplash(false); }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <div className="h-full w-full overflow-hidden bg-white">
              <AnimatePresence mode="wait">
                {showSplash ? (
                  <SplashScreen key="splash" />
                ) : (
                  <AnimatedRoutes key="main-app" />
                )}
              </AnimatePresence>
              <KeyboardSimulator />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;