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
      // 1. 기존 프로필 조회
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, bio, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.nickname) {
        setProfile(data);
      } else {
        // 2. 닉네임이 없으면 랜덤 생성 및 저장
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
    } finally {
      // 프로필 로드 성공 여부와 상관없이 인증 로딩은 종료
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 초기 세션 확인
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await ensureProfile(initialSession.user.id, initialSession.user.email);
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

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        if (event === 'SIGNED_IN') {
          await ensureProfile(currentSession.user.id, currentSession.user.email);
        } else {
          // 이미 세션이 있는 경우(INITIAL_SESSION 등) 로딩 종료 보장
          setLoading(false);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // 5초 후에는 강제로 로딩 종료 (안전장치)
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] 인증 로딩 타임아웃 - 강제 종료');
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [ensureProfile, loading]);

  const refreshProfile = async () => {
    if (user) await ensureProfile(user.id, user.email);
  };

  const updateProfileState = (updates: Partial<Profile>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : { nickname: null, avatar_url: null, bio: null, email: null, ...updates });
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, updateProfileState, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);