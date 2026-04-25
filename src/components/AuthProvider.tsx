import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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

  // ✅ interval을 useRef로 관리하여 클로저/누수 문제 완전 차단
  const lastSeenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

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

  // ✅ interval 시작/재시작을 단일 함수로 통합 — 중복 등록 원천 차단
  const startLastSeenInterval = (userId: string) => {
    // 기존 interval이 있으면 반드시 먼저 해제
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }

    // 같은 유저면 즉시 1회 실행, 이후 5분마다 갱신
    // (1분 → 5분으로 늘려 Supabase Warp 커넥션 부하 감소)
    updateLastSeen(userId);
    lastSeenIntervalRef.current = setInterval(() => {
      updateLastSeen(userId);
    }, 5 * 60 * 1000); // 5분

    currentUserIdRef.current = userId;
  };

  const stopLastSeenInterval = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
    currentUserIdRef.current = null;
  };

  const fetchProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!data && !error) {
        const defaultNickname = userEmail ? userEmail.split("@")[0] : "탐험가";
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .upsert([
            {
              id: userId,
              nickname: defaultNickname,
              avatar_url: `https://i.pravatar.cc/150?u=${userId}`,
              bio: "지도를 여행하는 탐험가 📍",
              updated_at: new Date().toISOString(),
            },
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
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        // ✅ 세션 확인 즉시 로딩 종료 (프로필은 백그라운드 로드)
        setLoading(false);

        if (initialSession?.user) {
          const userId = initialSession.user.id;
          // 프로필 fetch와 last_seen interval은 병렬 시작
          fetchProfile(userId, initialSession.user.email);
          startLastSeenInterval(userId);
        }
      } catch (error) {
        console.error("[AuthProvider] Auth init error:", error);
        setLoading(false);
      }
    };

    initSession();

    // ✅ onAuthStateChange: initSession과 중복 실행되지 않도록
    // INITIAL_SESSION 이벤트는 무시하고 실제 상태 변경만 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // INITIAL_SESSION은 initSession에서 이미 처리했으므로 스킵
        if (event === "INITIAL_SESSION") return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (currentSession?.user) {
          const userId = currentSession.user.id;
          fetchProfile(userId, currentSession.user.email);

          // ✅ 같은 유저면 interval 재시작 불필요 (TOKEN_REFRESHED 등 빈번한 이벤트 대응)
          if (currentUserIdRef.current !== userId) {
            startLastSeenInterval(userId);
          }
        } else {
          // 로그아웃 시 interval 정리
          setProfile(null);
          stopLastSeenInterval();
        }
      }
    );

    // ✅ 컴포넌트 언마운트 시 모든 리소스 정리
    return () => {
      subscription.unsubscribe();
      stopLastSeenInterval();
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id, user.email ?? undefined);
  };

  const signOut = async () => {
    stopLastSeenInterval();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};