"use client";

import { useState, useEffect } from 'react';
import { blockedStore } from '@/utils/blocked-store';
import { useAuth } from '@/components/AuthProvider';

export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState(blockedStore.getAll());

  useEffect(() => {
    const unsubscribe = blockedStore.subscribe(() => {
      setBlockedIds(blockedStore.getAll());
    });
    return () => { unsubscribe(); };
  }, []);

  const blockUser = (targetUserId: string) => {
    if (!user) return;
    blockedStore.add(user.id, targetUserId);
  };

  return {
    blockedIds,
    blockUser,
    isBlocked: (userId: string) => blockedIds.has(userId),
  };
}
