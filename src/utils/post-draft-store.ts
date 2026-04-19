"use client";

// 작성 중인 게시물 데이터를 메모리에 유지하는 스토어
interface PostDraft {
  content: string;
  image: string | null;
}

let draft: PostDraft = {
  content: '',
  image: null
};

const listeners = new Set<() => void>();

export const postDraftStore = {
  get: () => ({ ...draft }),
  set: (newDraft: Partial<PostDraft>) => {
    draft = { ...draft, ...newDraft };
    listeners.forEach(l => l());
  },
  clear: () => {
    draft = { content: '', image: null };
    listeners.forEach(l => l());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};