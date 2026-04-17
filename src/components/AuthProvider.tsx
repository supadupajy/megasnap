"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfileState: (updates: Partial<Profile>) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  updateProfileState: () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      console.log('[Auth] DB에서 프로필 조회 시작:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, bio, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        console.log('[Auth] DB 프로필 확인됨:', data);
        setProfile(data);
      } else {
        console.log('[Auth] DB에 프로필 없음, 초기 상태 설정');
        setProfile({ nickname: null, avatar_url: null, bio: null, email: null });
      }
    } catch (err) {
      console.error('[Auth] 프로필 조회 오류:', err);
      setProfile({ nickname: null, avatar_url: null, bio: null, email: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfile(initialSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('[Auth] 초기 인증 오류:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      console.log('[Auth] 인증 상태 변경:', event);

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        // 로그인 또는 세션 갱신 시 프로필 다시 조회
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchProfile(currentSession.user.id);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfileState = (updates: Partial<Profile>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : { nickname: null, avatar_url: null, bio: null, email: null, ...updates });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, updateProfileState, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);