"use client";

// 메모리 상에 읽은 포스트 ID를 저장하는 간단한 스토어
const viewedIds = new Set<string>();
const listeners = new Set<() => void>();

export const viewedStore = {
  add: (id: string) => {
    if (!viewedIds.has(id)) {
      viewedIds.add(id);
      listeners.forEach(l => l());
    }
  },
  has: (id: string) => viewedIds.has(id),
  getAll: () => new Set(viewedIds),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};