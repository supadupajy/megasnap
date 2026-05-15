import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { blockedStore } from "@/utils/blocked-store";
import { generateUniqueNickname } from "@/utils/nickname-generator";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  commentedPostIds: Set<string>;
  markCommented: (postId: string) => void;
  unmarkCommented: (postId: string) => void;
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
  const [commentedPostIds, setCommentedPostIds] = useState<Set<string>>(() => new Set());

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
        const uniqueNickname = await generateUniqueNickname();
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .upsert([
            {
              id: userId,
              email: userEmail ?? null,
              nickname: uniqueNickname,
              avatar_url: '/placeholder.svg',
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

  const savePendingAgreement = async (userId: string) => {
    const raw = localStorage.getItem('pending_agreement');
    if (!raw) return;
    try {
      const agreement = JSON.parse(raw);
      const { error } = await supabase.from('user_agreements').upsert(
        { user_id: userId, ...agreement },
        { onConflict: 'user_id' }
      );
      if (!error) {
        localStorage.removeItem('pending_agreement');
      } else {
        console.error('[AuthProvider] savePendingAgreement error:', error);
      }
    } catch (err) {
      console.error('[AuthProvider] savePendingAgreement parse error:', err);
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

  // 사용자가 댓글을 단 모든 post/ad ID를 한 번에 로드
  // -> PostItem, PostDetail에서 댓글 아이콘 색을 즉시 결정해 깜빡임 방지
  const fetchCommentedPostIds = async (userId: string) => {
    try {
      const [{ data: postComments }, { data: adComments }] = await Promise.all([
        supabase.from('comments').select('post_id').eq('user_id', userId),
        supabase.from('ad_comments').select('ad_id').eq('user_id', userId),
      ]);
      const next = new Set<string>();
      (postComments || []).forEach((row: any) => { if (row.post_id) next.add(row.post_id); });
      (adComments || []).forEach((row: any) => { if (row.ad_id) next.add(row.ad_id); });
      setCommentedPostIds(next);
    } catch (err) {
      console.error('[AuthProvider] fetchCommentedPostIds error:', err);
    }
  };

  const markCommented = (postId: string) => {
    setCommentedPostIds(prev => {
      if (prev.has(postId)) return prev;
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  };

  const unmarkCommented = (postId: string) => {
    setCommentedPostIds(prev => {
      if (!prev.has(postId)) return prev;
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  // 딥링크(이메일 인증 등)로 앱이 열렸을 때 토큰 처리
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        console.log('[AuthProvider] Deep link received:', url);
        // com.chorasnap.chorasnap://login-callback#access_token=...&refresh_token=...
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;
        const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) console.error('[AuthProvider] setSession error:', error);
        }
      } catch (err) {
        console.error('[AuthProvider] Deep link handling error:', err);
      }
    };

    // 앱이 실행 중일 때 딥링크로 열리는 경우
    const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
      handleDeepLink(url);
    });

    // 앱이 종료된 상태에서 딥링크로 열리는 경우 (getLaunchUrl)
    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) handleDeepLink(result.url);
    });

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, []);

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
            fetchCommentedPostIds(userId);
            startLastSeenInterval(userId);
            registerVisibilityEvents(userId);
            blockedStore.loadFromDB(userId);
          } else if (isNewUser) {
            // 새 유저 로그인
            currentUserIdRef.current = userId;
            fetchProfile(userId, currentSession.user.email);
            fetchIsAdmin(userId);
            fetchCommentedPostIds(userId);
            startLastSeenInterval(userId);
            registerVisibilityEvents(userId);
            blockedStore.loadFromDB(userId);
            // 회원가입 시 저장해둔 약관 동의 정보가 있으면 DB에 저장
            if (event === 'SIGNED_IN') {
              savePendingAgreement(userId);
            }
          } else if (event === "USER_UPDATED") {
            profileFetchingRef.current = null;
            fetchProfile(userId, currentSession.user.email);
            fetchIsAdmin(userId);
          }
        } else {
          currentUserIdRef.current = null;
          setProfile(null);
          setIsAdmin(false);
          setCommentedPostIds(new Set());
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
    setCommentedPostIds(new Set());
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, isAdmin, commentedPostIds, markCommented, unmarkCommented, refreshProfile, signOut }}
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