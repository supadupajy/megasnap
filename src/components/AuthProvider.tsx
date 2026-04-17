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
      console.log('[Auth] 프로필 확인 및 자동 생성 시작:', userId);
      
      // 1. 기존 프로필 조회
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, bio, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.nickname) {
        console.log('[Auth] 기존 닉네임 확인됨:', data.nickname);
        setProfile(data);
      } else {
        // 2. 닉네임이 없으면 랜덤 생성 및 저장
        const randomId = Math.random().toString(36).substring(2, 7);
        const generatedNickname = `탐험가_${randomId}`;
        
        console.log('[Auth] 닉네임 자동 생성:', generatedNickname);
        
        const newProfile = {
          id: userId,
          nickname: generatedNickname,
          email: email || null,
          updated_at: new Date().toISOString()
        };

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(newProfile);

        if (upsertError) throw upsertError;

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await ensureProfile(currentSession.user.id, currentSession.user.email);
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
  }, [ensureProfile]);

  const refreshProfile = async () => {
    if (user) await ensureProfile(user.id, user.email);
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