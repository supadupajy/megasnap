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
    if (userthink
The user wants me to continue my previous response exactly where it left off.

Looking at the previous response:
It ended abruptly in `src/components/AuthProvider.tsx` inside the `refreshProfile` function:
```typescript
  const refreshProfile = async () => {
    if (user
```

I need to complete `src/components/AuthProvider.tsx`, then provide the other files I mentioned in the summary: `src/App.tsx`, `src/pages/Popular.tsx`, and `src/pages/Profile.tsx`.

Plan:
1. Complete `src/components/AuthProvider.tsx`.
2. Write `src/App.tsx` with the updated `ProtectedRoute` timeout.
3. Write `src/pages/Popular.tsx` with the local timeout redirect.
4. Write `src/pages/Profile.tsx` with the local timeout redirect.

Let's finish `src/components/AuthProvider.tsx` first.

```typescript
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
```

Now `src/App.tsx`:
I need to add a timeout to `ProtectedRoute`.

```typescript
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setTimedOut(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }
  
  if (!session || timedOut) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
```

Now `src/pages/Popular.tsx`:
Add a 3-second timeout to redirect to login if `isInitialLoading` stays true.

```typescript
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitialLoading && !authUser) {
        navigate('/login', { replace: true });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isInitialLoading, authUser, navigate]);
```

Now `src/pages/Profile.tsx`:
Same logic.

```typescript
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDataLoading && !authUser) {
        navigate('/login', { replace: true });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDataLoading, authUser, navigate]);
```

Wait, I should check if I need to rewrite the whole files or just the parts. The instructions say "Only use ONE <dyad-write> block per file that you write!". So I must write the full files.

Let's start.) await ensureProfile(user.id, user.email);
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