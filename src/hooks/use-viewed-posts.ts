"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export function useViewedPosts() {
  const { user } = useAuth();
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const fetchControllerRef = useRef<AbortController | null>(null);

  // 서버에서 조회 기록 가져오기
  const fetchViewedHistory = useCallback(async () => {
    if (!user) return;

    // 이전 요청이 진행 중이면 취소
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    try {
      const { data, error } = await supabase
        .from('viewed_posts')
        .select('post_id')
        .eq('user_id', user.id)
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;
      if (error) throw error;

      if (data) {
        const ids = new Set(data.map(item => item.post_id));
        setViewedIds(ids);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) return;
      console.error('[useViewedPosts] Failed to fetch viewed history:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchViewedHistory();
    } else {
      setViewedIds(new Set());
    }
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [user, fetchViewedHistory]);

  // 조회 기록 저장
  const markAsViewed = useCallback(async (postId: string) => {
    if (!user || !postId || viewedIds.has(postId)) return;

    // 로컬 상태 즉시 업데이트 (UI 반응성)
    setViewedIds(prev => new Set(prev).add(postId));

    try {
      const { error } = await supabase
        .from('viewed_posts')
        .upsert(
          { user_id: user.id, post_id: postId },
          { onConflict: 'user_id, post_id' }
        );

      if (error) throw error;
    } catch (err) {
      console.error('[useViewedPosts] Failed to save view:', err);
    }
  }, [user, viewedIds]);

  return {
    viewedIds,
    markAsViewed,
    refreshViewed: fetchViewedHistory
  };
}
