"use client";

// 차단된 사용자 ID를 저장하는 셋
const blockedUserIds = new Set<string>();
const listeners = new Set<() => void>();

export const blockedStore = {
  add: (userId: string) => {
    if (!blockedUserIds.has(userId)) {
      blockedUserIds.add(userId);
      listeners.forEach(l => l());
    }
  },
  has: (userId: string) => blockedUserIds.has(userId),
  getAll: () => new Set(blockedUserIds),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};