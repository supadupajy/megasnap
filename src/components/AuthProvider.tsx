import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error) setProfile(data);
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  useEffect(() => {
    // 강제 로딩 해제 타이머 (최후의 수단)
    const fallbackTimer = setTimeout(() => {
      if (!initialized.current) {
        setLoading(false);
        initialized.current = true;
      }
    }, 3000);

    const initializeAuth = async () => {
      try {
        // 1. 현재 세션 확인 (로컬 스토리지에서 복구)
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        setLoading(false);
        initialized.current = true;
        clearTimeout(fallbackTimer);
      }
    };

    initializeAuth();

    // 2. 인증 상태 변화 감지 (로그인, 로그아웃, 토큰 갱신 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
        initialized.current = true;
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const value = React.useMemo(() => ({
    session, user, profile, loading, refreshProfile, signOut
  }), [session, user, profile, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};