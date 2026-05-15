"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export function useViewedPosts() {
  const { user } = useAuth();
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [initialViewedIds, setInitialViewedIds] = useState<Set<string>>(new Set());
  const [hasLoadedViewedHistory, setHasLoadedViewedHistory] = useState(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  // 이번 세션에서 record-post-view edge function을 이미 호출한 postId 집합.
  // 서버 측에서도 IP+UA+시간 단위로 중복을 제거하지만, 클라이언트에서 한 번 더 막아
  // 동일 스크롤 세션 중 불필요한 네트워크 호출을 줄인다.
  const recordedViewIdsRef = useRef<Set<string>>(new Set());

  // 서버에서 조회 기록 가져오기
  const fetchViewedHistory = useCallback(async () => {
    if (!user) {
      setHasLoadedViewedHistory(true);
      return;
    }

    setHasLoadedViewedHistory(false);

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
        setInitialViewedIds(ids);
      }
      setHasLoadedViewedHistory(true);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) return;
      console.error('[useViewedPosts] Failed to fetch viewed history:', err);
      setHasLoadedViewedHistory(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchViewedHistory();
    } else {
      setViewedIds(new Set());
      setInitialViewedIds(new Set());
      setHasLoadedViewedHistory(true);
    }
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [user, fetchViewedHistory]);

  // 조회 기록 저장
  // - viewed_posts 테이블(개인용 \"내가 본 글\" 기록) + post_views(전역 조회수) 둘 다에 반영
  // - 인기 컨텐츠/Flicks/근처/친구 피드 등 어떤 화면에서든 카드가 화면에 노출되면
  //   조회수가 1회 카운트되도록 한다. (PostDetail은 별도로 자체 호출하며, edge function이
  //   IP+UA+시간 단위로 중복을 제거하므로 이중 호출되어도 안전하다.)
  const markAsViewed = useCallback(async (postId: string) => {
    // UUID 형식이 아닌 ID(광고 마커 등)는 DB 저장 스킵
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!postId || !UUID_REGEX.test(postId)) return;

    // 전역 조회수 기록 (로그인 여부와 무관하게 1회 시도; edge function이 자체 dedupe 함)
    if (!recordedViewIdsRef.current.has(postId)) {
      recordedViewIdsRef.current.add(postId);
      // fire-and-forget — UI를 막지 않음
      supabase.functions
        .invoke('record-post-view', { body: { postId } })
        .then(({ data }) => {
          if ((data as any)?.counted) {
            // 다른 화면(예: 인기 패널, 트렌딩 리스트)이 즉시 카운터를 갱신할 수 있도록 알림
            window.dispatchEvent(
              new CustomEvent('post-view-recorded', { detail: { postId } })
            );
          }
        })
        .catch((err) => {
          // 실패 시 다음 노출 때 다시 시도할 수 있도록 dedupe 셋에서 제거
          recordedViewIdsRef.current.delete(postId);
          console.error('[useViewedPosts] record-post-view failed:', err);
        });
    }

    // 개인 \"내가 본 글\" 기록 (로그인 사용자만)
    if (!user || viewedIds.has(postId)) return;

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
    initialViewedIds,
    markAsViewed,
    refreshViewed: fetchViewedHistory,
    hasLoadedViewedHistory,
  };
}