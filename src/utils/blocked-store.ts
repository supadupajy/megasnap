"use client";

import { supabase } from '@/integrations/supabase/client';

// 차단된 사용자 ID를 저장하는 셋 (메모리 캐시)
const blockedUserIds = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());

export const blockedStore = {
  // DB에서 차단 목록 초기 로드 (앱 시작 / 로그인 시 호출)
  loadFromDB: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) throw error;

      blockedUserIds.clear();
      data?.forEach(row => blockedUserIds.add(row.blocked_id));
      notify();
    } catch (err) {
      console.error('[blockedStore] loadFromDB error:', err);
    }
  },

  // 차단 추가: 메모리 + DB
  add: async (blockerId: string, blockedId: string) => {
    if (blockedUserIds.has(blockedId)) return;
    blockedUserIds.add(blockedId);
    notify();

    try {
      const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: blockerId, blocked_id: blockedId });
      if (error) throw error;
    } catch (err) {
      // DB 저장 실패 시 메모리에서도 롤백
      blockedUserIds.delete(blockedId);
      notify();
      console.error('[blockedStore] add error:', err);
    }
  },

  // 차단 해제: 메모리 + DB
  remove: async (blockerId: string, blockedId: string) => {
    blockedUserIds.delete(blockedId);
    notify();

    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    } catch (err) {
      blockedUserIds.add(blockedId);
      notify();
      console.error('[blockedStore] remove error:', err);
    }
  },

  has: (userId: string) => blockedUserIds.has(userId),
  getAll: () => new Set(blockedUserIds),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
