"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, bio, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data);
      } else {
        // 프로필이 없는 경우 기본값 설정
        setProfile({ nickname: null, avatar_url: null, bio: null, email: null });
      }
    } catch (err) {
      console.error('[Auth] Profile fetch error:', err);
      setProfile({ nickname: null, avatar_url: null, bio: null, email: null });
    }
  };

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
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        // 로그인이나 토큰 갱신 시 프로필 다시 가져오기
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchProfile(currentSession.user.id);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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