"use client";

import { useState, useEffect } from 'react';
import { blockedStore } from '@/utils/blocked-store';

export function useBlockedUsers() {
  const [blockedIds, setBlockedIds] = useState(blockedStore.getAll());

  useEffect(() => {
    const unsubscribe = blockedStore.subscribe(() => {
      setBlockedIds(blockedStore.getAll());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    blockedIds,
    blockUser: blockedStore.add,
    isBlocked: (userId: string) => blockedIds.has(userId)
  };
}