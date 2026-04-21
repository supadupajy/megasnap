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

    // 실시간 온라인 상태 업데이트 구독
    const channel = supabase
      .channel('follow-list-online-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          setUsers(prev => prev.map(user => 
            user.id === payload.new.id ? { ...user, last_seen: payload.new.last_seen } : user
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    <div className="h-screen overflow-y-auto bg-white no-scrollbar">
      <header className="fixed top-0 left-0 right-0 h-[88px] pt-8 bg-white z-50 flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="flex-1 text-center mr-10">
          <h1 className="font-black text-lg text-gray-900">{targetNickname}</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Follow Info</p>
        </div>
      </header>

      <div className="pt-[88px]">
        <div className="flex border-b border-gray-100 sticky top-[88px] bg-white z-40">
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
              
              // 온라인 상태 계산 (최근 5분 이내 활동)
              const isOnline = user.last_seen && (new Date().getTime() - new Date(user.last_seen).getTime()) / (1000 * 60) < 5;

              return (
                <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all relative">
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 relative">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    {/* 온라인 상태 점 표시 */}
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