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
    updateLastSeen(userId);
    lastSeenIntervalRef.current = setInterval(() => {
      updateLastSeen(userId);
    }, 10 * 60 * 1000);
    currentUserIdRef.current = userId;
  };

  const stopLastSeenInterval = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
    currentUserIdRef.current = null;
  };

  const handleForeground = (userId: string) => {
    startLastSeenInterval(userId);
  };

  const handleBackground = () => {
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
  };

  const registerVisibilityEvents = (userId: string) => {
    if (capListenerRef.current) {
      capListenerRef.current.remove();
      capListenerRef.current = null;
    }

    if (isMobilePlatform()) {
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
      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          handleForeground(userId);
        } else {
          handleBackground();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
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
    } catch (err) {
      console.error("[AuthProvider] Profile fetch error:", err);
    } finally {
      profileFetchingRef.current = null;
    }
  };

  const fetchIsAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", userId)
        .limit(1);
      const result = Array.isArray(data) && data.length > 0 && data[0].role === "admin";
      setIsAdmin(result);
    } catch (e) {
      console.error("[AuthProvider] fetchIsAdmin error:", e);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // onAuthStateChange 단일 진입점으로 통합
    // INITIAL_SESSION 이벤트가 현재 세션 상태를 즉시 전달하므로 getSession() 별도 호출 불필요
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (currentSession?.user) {
          const userId = currentSession.user.id;
          const isNewUser = currentUserIdRef.current !== userId;

          // INITIAL_SESSION은 항상 admin 체크 (순서 무관하게 보장)
          if (event === "INITIAL_SESSION") {
            currentUserIdRef.current = userId;
            fetchProfile(userId, currentSession.user.email);
            fetchIsAdmin(userId);
            startLastSeenInterval(userId);
            registerVisibilityEvents(userId);
            blockedStore.loadFromDB(userId);
          } else if (isNewUser) {
            // 새 유저 로그인
            currentUserIdRef.current = userId;
            fetchProfile(userId, currentSession.user.email);
            fetchIsAdmin(userId);
            startLastSeenInterval(userId);
            registerVisibilityEvents(userId);
            blockedStore.loadFromDB(userId);
          } else if (event === "USER_UPDATED") {
            profileFetchingRef.current = null;
            fetchProfile(userId, currentSession.user.email);
            fetchIsAdmin(userId);
          }
        } else {
          currentUserIdRef.current = null;
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
    setIsAdmin(false);
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
