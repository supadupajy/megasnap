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
        .maybeSingle();

      if (!data && !error) {
        const defaultNickname = userEmail ? userEmail.split('@')[0] : '탐험가';
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .upsert([
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
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("[AuthProvider] Profile fetch error:", err);
    }
  };

  useEffect(() => {
    let lastSeenInterval: any;

    const updateLastSeen = async (userId: string) => {
      try {
        await supabase
          .from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", userId);
      } catch (err) {
        console.error("[AuthProvider] Update last_seen error:", err);
      }
    };

    const initSession = async () => {
      try {
        // 1. 세션 정보를 먼저 가져옴
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        // 2. 세션 확인 즉시 로딩 종료 (프로필은 배경에서 로드)
        setLoading(false);
        
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id, initialSession.user.email);
          updateLastSeen(initialSession.user.id);
          
          // 2분마다 마지막 활동 시간 업데이트
          lastSeenInterval = setInterval(() => {
            updateLastSeen(initialSession.user.id);
          }, 1000 * 60 * 2);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          fetchProfile(currentSession.user.id, currentSession.user.email);
          updateLastSeen(currentSession.user.id);
          
          if (lastSeenInterval) clearInterval(lastSeenInterval);
          lastSeenInterval = setInterval(() => {
            updateLastSeen(currentSession.user.id);
          }, 1000 * 60 * 2);
        } else {
          setProfile(null);
          if (lastSeenInterval) clearInterval(lastSeenInterval);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (lastSeenInterval) clearInterval(lastSeenInterval);
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