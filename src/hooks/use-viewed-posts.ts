"use client";

import { useState, useEffect } from 'react';
import { viewedStore } from '@/utils/viewed-store';

export function useViewedPosts() {
  const [viewedIds, setViewedIds] = useState(viewedStore.getAll());

  useEffect(() => {
    const unsubscribe = viewedStore.subscribe(() => {
      setViewedIds(viewedStore.getAll());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    viewedIds,
    markAsViewed: viewedStore.add
  };
}