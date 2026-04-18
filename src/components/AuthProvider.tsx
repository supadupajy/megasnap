import React, { createContext, useContext, useEffect, useState } from "react";
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

  const fetchProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const defaultNickname = userEmail ? userEmail.split('@')[0] : '탐험가';
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert([
            {
              id: userId,
              nickname: defaultNickname,
              avatar_url: `https://i.pravatar.cc/150?u=${userId}`,
              bio: "지도를 여행하는 탐험가 📍",
              updated_at: new Date().toISOString()
            }
          ])
          .select()
          .single();

        if (!insertError) setProfile(newProfile);
      } else if (!error) {
        setProfile(data);
      }
    } catch (err) {
      console.error("[AuthProvider] Profile fetch error:", err);
    }
  };

  useEffect(() => {
    // 초기 세션 확인
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        // 세션이 확인되면 즉시 로딩 해제 (프로필은 백그라운드에서 로드)
        setLoading(false);

        if (initialSession?.user) {
          fetchProfile(initialSession.user.id, initialSession.user.email);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        setLoading(false);
      }
    };

    initSession();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          fetchProfile(currentSession.user.id, currentSession.user.email);
        } else {
          setProfile(null);
        }
        
        // 상태 변경 시에도 로딩 해제 보장
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id, user.email);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};