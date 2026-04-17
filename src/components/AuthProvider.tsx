import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 초기화 완료 여부를 체크하는 Ref
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
    // [강제 해제] 2.5초 후에도 앱이 안 뜨면 무조건 loading을 풉니다.
    const fallbackTimer = setTimeout(() => {
      if (!initialized.current) {
        console.warn("⚠️ 인증 확인이 지연되어 강제로 로딩을 해제합니다.");
        setLoading(false);
        initialized.current = true;
      }
    }, 2500);

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (!initialized.current) {
          setLoading(false);
          initialized.current = true;
          clearTimeout(fallbackTimer);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }

        if (!initialized.current) {
          setLoading(false);
          initialized.current = true;
          clearTimeout(fallbackTimer);
        }
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

  const value = React.useMemo(() => ({
    session, user, profile, loading, refreshProfile
  }), [session, user, profile, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth error");
  return context;
};