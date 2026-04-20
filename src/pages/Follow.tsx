"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, UserPlus, Check, Loader2, Users } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

const Follow = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  const { user: authUser } = useAuth();
  
  const initialTab = (location.state as any)?.tab || 'followers';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetNickname, setTargetNickname] = useState('');

  const fetchFollowData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single();
      if (profile) setTargetNickname(profile.nickname || '사용자');

let query;
if (activeTab === 'followers') {
  // 나를 팔로우하는 사람들
  query = supabase
    .from('follows')
    .select(`
      follower:profiles!follows_follower_id_fkey (id, nickname, avatar_url, bio)
    `)
    .eq('following_id', userId);
} else {
  // 내가 팔로우하는 사람들
  query = supabase
    .from('follows')
    .select(`
      following:profiles!follows_following_id_fkey (id, nickname, avatar_url, bio)
    `)
    .eq('follower_id', userId);
}

const { data, error } = await query;
if (error) throw error;

const formattedUsers = (data || []).map((item: any) => {
  return activeTab === 'followers' ? item.follower : item.following;
}).filter(Boolean);

setUsers(formattedUsers);

  useEffect(() => {
    fetchFollowData();
  }, [fetchFollowData]);

  const toggleFollow = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    setUsers(prev => prev.map(u => 
      u.id === targetId ? { ...u, isFollowing: !u.isFollowing } : u
    ));
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
            users.map((user) => (
              <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all">
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">{user.nickname?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{user.nickname || '사용자'}</p>
                  <p className="text-xs text-gray-500 truncate">{user.bio || 'Chora 탐험가'}</p>
                </div>
                {authUser?.id !== user.id && (
                  <Button 
                    variant={user.isFollowing ? "secondary" : "default"} 
                    size="sm" 
                    onClick={(e) => toggleFollow(e, user.id)}
                    className={cn("rounded-xl h-8 px-3 font-bold", user.isFollowing ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : "bg-indigo-600 hover:bg-indigo-700 text-white")}
                  >
                    {user.isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            ))
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