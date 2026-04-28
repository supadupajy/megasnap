import React, { useState, useEffect } from 'react';
import { ChevronLeft, Lock, Globe, UserX, Trash2, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { blockedStore } from '@/utils/blocked-store';
import { showSuccess, showError } from '@/utils/toast';
import BottomNav from '@/components/BottomNav';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BlockedUser {
  blocked_id: string;
  created_at: string;
  profile: {
    nickname: string;
    avatar_url: string;
  } | null;
}

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [isPrivate, setIsPrivate] = useState<boolean>(profile?.is_private ?? false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);

  useEffect(() => {
    setIsPrivate(profile?.is_private ?? false);
  }, [profile]);

  useEffect(() => {
    if (user) fetchBlockedUsers();
  }, [user]);

  const fetchBlockedUsers = async () => {
    setLoadingBlocks(true);
    try {
      // DB에서 최신 차단 목록 재로드 후 프로필 조회
      await blockedStore.loadFromDB(user!.id);
      const ids = Array.from(blockedStore.getAll());

      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', ids);

        const merged: BlockedUser[] = ids.map(id => ({
          blocked_id: id,
          created_at: '',
          profile: profiles?.find(p => p.id === id)
            ? { nickname: profiles.find(p => p.id === id)!.nickname, avatar_url: profiles.find(p => p.id === id)!.avatar_url }
            : null,
        }));
        setBlockedUsers(merged);
      } else {
        setBlockedUsers([]);
      }
    } catch (err) {
      console.error('[PrivacySettings] fetchBlockedUsers error:', err);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleTogglePrivate = async (value: boolean) => {
    setIsPrivate(value);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_private: value })
        .eq('id', user!.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess(value ? '계정이 비공개로 설정되었습니다. 🔒' : '계정이 공개로 설정되었습니다. 🌐');
    } catch (err: any) {
      showError('설정 변경에 실패했습니다.');
      setIsPrivate(!value);
    }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    try {
      await blockedStore.remove(user!.id, unblockTarget.blocked_id);
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== unblockTarget.blocked_id));
      showSuccess(`${unblockTarget.profile?.nickname ?? '사용자'} 님의 차단이 해제되었습니다.`);
    } catch (err: any) {
      showError('차단 해제에 실패했습니다.');
    } finally {
      setUnblockTarget(null);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate('/settings');
          }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">개인정보 보호</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">

        {/* 계정 공개 설정 */}
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">계정 공개 범위</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* 공개 */}
            <button
              onClick={() => handleTogglePrivate(false)}
              className={`w-full flex items-center gap-3 p-4 border-b border-gray-50 transition-colors ${!isPrivate ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!isPrivate ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <Globe className={`w-5 h-5 ${!isPrivate ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-bold ${!isPrivate ? 'text-indigo-700' : 'text-gray-700'}`}>공개 계정</p>
                <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">
                  누구나 내 포스팅과 프로필을 볼 수 있어요
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${!isPrivate ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                {!isPrivate && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>

            {/* 비공개 */}
            <button
              onClick={() => handleTogglePrivate(true)}
              className={`w-full flex items-center gap-3 p-4 transition-colors ${isPrivate ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPrivate ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <Lock className={`w-5 h-5 ${isPrivate ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-bold ${isPrivate ? 'text-indigo-700' : 'text-gray-700'}`}>비공개 계정</p>
                <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">
                  팔로워만 내 포스팅과 프로필을 볼 수 있어요
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isPrivate ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                {isPrivate && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
          </div>

          {isPrivate && (
            <div className="mt-2 px-1">
              <p className="text-[11px] text-indigo-500 font-medium">
                🔒 비공개 계정으로 설정되어 있습니다. 팔로우 요청을 수락한 사람만 내 콘텐츠를 볼 수 있어요.
              </p>
            </div>
          )}
        </div>

        {/* 차단 목록 */}
        <div className="px-4 pt-6 pb-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">차단 목록</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingBlocks ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-6 flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                  <UserX className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-400">차단한 사용자가 없습니다</p>
                <p className="text-[11px] text-gray-300 font-medium text-center">
                  사용자 프로필에서 차단할 수 있어요
                </p>
              </div>
            ) : (
              blockedUsers.map((b) => (
                <div key={b.blocked_id} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-none">
                  <img
                    src={b.profile?.avatar_url || `https://i.pravatar.cc/150?u=${b.blocked_id}`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 grayscale opacity-60"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{b.profile?.nickname ?? '알 수 없는 사용자'}</p>
                    <p className="text-[11px] text-gray-400 font-medium">차단됨</p>
                  </div>
                  <button
                    onClick={() => setUnblockTarget(b)}
                    className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
                  >
                    차단 해제
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <BottomNav />

      <AlertDialog open={!!unblockTarget} onOpenChange={(open) => !open && setUnblockTarget(null)}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">
              차단 해제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-medium leading-relaxed">
              <span className="font-black text-gray-700">{unblockTarget?.profile?.nickname ?? '이 사용자'}</span> 님의 차단을 해제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnblock}
              className="flex-1 h-12 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-100 transition-all m-0"
            >
              차단 해제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PrivacySettings;
