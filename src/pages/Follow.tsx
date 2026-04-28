"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, UserPlus, Check, Loader2, Users } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

const Follow = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  const { user: authUser } = useAuth();
  
  const initialTab = (location.state as any)?.tab || 'followers';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [targetNickname, setTargetNickname] = useState('');

  const fetchFollowingList = useCallback(async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id);
    if (data) setFollowingIds(new Set(data.map(f => f.following_id)));
  }, [authUser]);

  const fetchFollowData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await fetchFollowingList();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single();
      if (profile) setTargetNickname(profile.nickname || '사용자');

      let query;
      if (activeTab === 'followers') {
        query = supabase
          .from('follows')
          .select(`profiles:follower_id (id, nickname, avatar_url, bio, last_seen)`)
          .eq('following_id', userId);
      } else {
        query = supabase
          .from('follows')
          .select(`profiles:following_id (id, nickname, avatar_url, bio, last_seen)`)
          .eq('follower_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedUsers = (data || []).map((item: any) => item.profiles).filter(Boolean);
      setUsers(formattedUsers);
    } catch (err) {
      console.error('Error fetching follow data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, activeTab, fetchFollowingList]);

  useEffect(() => {
    fetchFollowData();
  }, [fetchFollowData]);

  useEffect(() => {
    if (users.length === 0) return;

    // [Fixed] profiles UPDATE 실시간 구독 → polling으로 대체.
    // 이유: 필터 없는 profiles UPDATE 구독이 모든 클라이언트에 fan-out 되어
    // Realtime 서버 부하(thread killed by timeout)의 주요 원인이었음.
    // 현재 화면에 보이는 사용자들의 last_seen만 60초마다 폴링하여 동일한 UX 유지.
    const userIds = users.map(u => u.id);
    const pollOnlineStatus = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, last_seen')
        .in('id', userIds);
      if (!data) return;
      const lastSeenMap = new Map(data.map(p => [p.id, p.last_seen]));
      setUsers(prev => prev.map(user =>
        lastSeenMap.has(user.id)
          ? { ...user, last_seen: lastSeenMap.get(user.id) }
          : user
      ));
    };
    const interval = setInterval(pollOnlineStatus, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [users.length]);

  const toggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!authUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    const isCurrentlyFollowing = followingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        showSuccess('팔로우를 취소했습니다.');
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: authUser.id, following_id: targetUserId });
        if (error) throw error;
        setFollowingIds(prev => new Set(prev).add(targetUserId));
        showSuccess('팔로우를 시작했습니다! ✨');
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      showError('처리에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 no-scrollbar">
      {/* 글로벌 헤더(64px) + safe area 아래에 서브 헤더 배치 */}
      <div className="pt-[64px]">
        {/* 서브 헤더: 뒤로가기 + 중앙 타이틀 */}
        <div className="sticky top-[64px] z-40 bg-white flex items-center px-4 h-14 border-b border-gray-50">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">{targetNickname}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Follow Info</p>
          </div>
        </div>

        {/* 팔로워 / 팔로잉 탭 */}
        <div className="flex border-b border-gray-100 sticky top-[120px] bg-white z-30">
          <button
            onClick={() => setActiveTab('followers')}
            className={cn(
              "flex-1 py-4 text-sm font-black transition-all relative",
              activeTab === 'followers' ? "text-indigo-600" : "text-gray-400"
            )}
          >
            팔로워
            {activeTab === 'followers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              "flex-1 py-4 text-sm font-black transition-all relative",
              activeTab === 'following' ? "text-indigo-600" : "text-gray-400"
            )}
          >
            팔로잉
            {activeTab === 'following' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>

        <div className="p-4 space-y-1">
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
          ) : users.length > 0 ? (
            users.map((user) => {
              const isFollowing = followingIds.has(user.id);
              const isOnline = user.last_seen && (new Date().getTime() - new Date(user.last_seen).getTime()) / (1000 * 60) < 10;

              return (
                <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all relative">
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 relative">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white z-10",
                      isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-300"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 truncate">{user.nickname || '사용자'}</p>
                      {isOnline && (
                        <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter leading-none px-1 py-0.5 bg-green-50 rounded-[4px]">Online</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p>
                  </div>
                  {authUser?.id !== user.id && (
                    <Button
                      variant={isFollowing ? "secondary" : "default"}
                      size="sm"
                      onClick={(e) => toggleFollow(e, user.id)}
                      className={cn("rounded-xl h-8 px-3 font-bold", isFollowing ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : "bg-indigo-600 hover:bg-indigo-700 text-white")}
                    >
                      {isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-200" /></div>
              <p className="text-sm text-gray-400 font-bold leading-relaxed">{activeTab === 'followers' ? '아직 팔로워가 없습니다.' : '아직 팔로잉하는 사용자가 없습니다.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Follow;