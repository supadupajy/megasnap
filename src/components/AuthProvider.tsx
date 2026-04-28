import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { blockedStore } from "@/utils/blocked-store";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isMobilePlatform = () =>
  Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const lastSeenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const capListenerRef = useRef<{ remove: () => void } | null>(null);
  // 중복 fetchProfile 호출 방지
  const profileFetchingRef = useRef<string | null>(null);

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

  const startLastSeenInterval = (userId: string) => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }

    // 즉시 1회 실행 후 10분마다 갱신
    updateLastSeen(userId);
    lastSeenIntervalRef.current = setInterval(() => {
      updateLastSeen(userId);
    }, 10 * 60 * 1000); // 10분

    currentUserIdRef.current = userId;
  };

  const stopLastSeenInterval = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
    currentUserIdRef.current = null;
  };

  // 포커스 복귀 시: 즉시 업데이트 + interval 재시작
  const handleForeground = (userId: string) => {
    startLastSeenInterval(userId);
  };

  // 백그라운드 전환 시: interval 정지 (불필요한 업데이트 차단)
  const handleBackground = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
  };

  const registerVisibilityEvents = (userId: string) => {
    // 기존 Capacitor 리스너 제거
    if (capListenerRef.current) {
      capListenerRef.current.remove();
      capListenerRef.current = null;
    }

    if (isMobilePlatform()) {
      // 네이티브: Capacitor appStateChange 사용
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          handleForeground(userId);
        } else {
          handleBackground();
        }
      }).then((handle) => {
        capListenerRef.current = handle;
      });
    } else {
      // 웹: visibilitychange 사용
      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          handleForeground(userId);
        } else {
          handleBackground();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      // cleanup을 capListenerRef에 통일하여 관리
      capListenerRef.current = {
        remove: () => document.removeEventListener("visibilitychange", handleVisibility),
      };
    }
  };

  const unregisterVisibilityEvents = () => {
    if (capListenerRef.current) {
      capListenerRef.current.remove();
      capListenerRef.current = null;
    }
  };

  const fetchProfile = async (userId: string, userEmail?: string) => {
    // 동일 유저에 대해 이미 fetch 중이면 skip
    if (profileFetchingRef.current === userId) return;
    profileFetchingRef.current = userId;

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

      // admin 여부 확인
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      setIsAdmin(roleData?.role === "admin");
    } catch (err) {
      console.error("[AuthProvider] Profile fetch error:", err);
    } finally {
      profileFetchingRef.current = null;
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);

        if (initialSession?.user) {
          const userId = initialSession.user.id;
          fetchProfile(userId, initialSession.user.email);
          startLastSeenInterval(userId);
          registerVisibilityEvents(userId);
          blockedStore.loadFromDB(userId);
        }
      } catch (error) {
        console.error("[AuthProvider] Auth init error:", error);
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === "INITIAL_SESSION") return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (currentSession?.user) {
          const userId = currentSession.user.id;
          // 프로필은 유저가 바뀌었을 때만 새로 fetch (TOKEN_REFRESHED 등에서 중복 방지)
          if (currentUserIdRef.current !== userId) {
            fetchProfile(userId, currentSession.user.email);
            startLastSeenInterval(userId);
            registerVisibilityEvents(userId);
            blockedStore.loadFromDB(userId);
          } else if (event === "USER_UPDATED") {
            // 프로필 정보가 변경된 경우에만 재조회
            profileFetchingRef.current = null;
            fetchProfile(userId, currentSession.user.email);
          }
        } else {
          setProfile(null);
          setIsAdmin(false);
          stopLastSeenInterval();
          unregisterVisibilityEvents();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      stopLastSeenInterval();
      unregisterVisibilityEvents();
    };
  }, []);

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id, user.email ?? undefined);
  };

  const signOut = async () => {
    stopLastSeenInterval();
    unregisterVisibilityEvents();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, isAdmin, refreshProfile, signOut }}
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