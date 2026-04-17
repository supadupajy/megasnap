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

  const ensureProfile = useCallback(async (userId: string, email: string | undefined) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, bio, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.nickname) {
        setProfile(data);
      } else {
        const randomId = Math.random().toString(36).substring(2, 7);
        const generatedNickname = `탐험가_${randomId}`;
        
        const newProfile = {
          id: userId,
          nickname: generatedNickname,
          email: email || null,
          updated_at: new Date().toISOString()
        };

        await supabase.from('profiles').upsert(newProfile);

        setProfile({
          nickname: generatedNickname,
          avatar_url: data?.avatar_url || null,
          bio: data?.bio || null,
          email: email || null
        });
      }
    } catch (err) {
      console.error('[Auth] 프로필 처리 중 오류:', err);
      setProfile({
        nickname: email?.split('@')[0] || '탐험가',
        avatar_url: null,
        bio: null,
        email: email || null
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 안전장치: 4초 후에도 로딩 중이면 강제로 로딩 종료 (페이지 리다이렉트 유도)
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] 세션 복구 타임아웃 - 로딩 강제 종료');
        setLoading(false);
      }
    }, 4000);

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await ensureProfile(initialSession.user.id, initialSession.user.email);
          }
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('[Auth] 세션 복구 오류:', error);
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await ensureProfile(currentSession.user.id, currentSession.user.email);
        }
        setLoading(false);
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
      clearTimeout(timeoutId);
    };
  }, [ensureProfile]);

  const refreshProfile = async () => {
    if (user) await ensureProfile(user.id, user.email);
  };

  const updateProfileState = (updates: Partial<Profile>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, updateProfileState, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);