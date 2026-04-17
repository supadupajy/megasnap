"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
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
        .select('nickname, avatar_url, bio')
        .eq('id', userId)
        .maybeSingle(); // single() 대신 maybeSingle()을 사용하여 데이터가 없을 때 에러 방지

      if (error) throw error;
      
      if (data) {
        setProfile(data);
      } else {
        // 프로필 행 자체가 없는 경우
        setProfile({ nickname: null, avatar_url: null, bio: null });
      }
    } catch (err) {
      console.error('[Auth] Profile fetch error:', err);
      setProfile({ nickname: null, avatar_url: null, bio: null });
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfile(initialSession.user.id);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('[Auth] Session check error:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        // 세션이 생겼을 때만 프로필을 다시 가져옴
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
    setProfile(prev => prev ? { ...prev, ...updates } : { nickname: null, avatar_url: null, bio: null, ...updates });
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, updateProfileState, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);