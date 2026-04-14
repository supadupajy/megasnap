"use client";

import { useState, useEffect } from 'react';
import { viewedStore } from '@/utils/viewed-store';

export function useViewedPosts() {
  const [viewedIds, setViewedIds] = useState(viewedStore.getAll());

  useEffect(() => {
    // 스토어 변경 시 상태 업데이트
    return viewedStore.subscribe(() => {
      setViewedIds(viewedStore.getAll());
    });
  }, []);

  return {
    viewedIds,
    markAsViewed: viewedStore.add
  };
}