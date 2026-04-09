"use client";

import React, { useState, useMemo } from 'react';
import { Search as SearchIcon, UserPlus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import WritePost from '@/components/WritePost';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MOCK_USERS = Array.from({ length: 50 }).map((_, i) => ({
  id: `user_${i + 100}`,
  nickname: [`traveler_${i}`, `explorer_${i}`, `seoul_life_${i}`, `snap_master_${i}`][i % 4],
  avatar: `https://i.pravatar.cc/150?u=user${i}`,
  bio: `안녕하세요! ${i % 3 === 0 ? '여행을 사랑하는' : '사진 찍는 게 취미인'} 사람입니다.`,
  followers: Math.floor(Math.random() * 5000),
  isFollowing: Math.random() > 0.8
}));

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const navigate = useNavigate();

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return MOCK_USERS.slice(0, 10); // 검색어 없을 때 추천 사용자 10명 노출
    
    return MOCK_USERS.filter(
      user => user.id.toLowerCase().includes(query) || user.nickname.toLowerCase().includes(query)
    ).slice(0, 15);
  }, [searchQuery]);

  const handleUserClick = (userId: string) => {
    // 실제로는 해당 유저의 데이터를 넘기겠지만, 여기서는 프로필 페이지로 이동
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header />
      
      <div className="pt-20 px-4">
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input 
            placeholder="아이디 또는 닉네임 검색" 
            className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-green-500 text-base"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider px-1">
            {searchQuery.trim() === '' ? '추천 사용자' : '검색 결과'}
          </p>
          
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div 
                key={user.id} 
                onClick={() => handleUserClick(user.id)}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer active:scale-[0.98]"
              >
                <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.nickname[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 truncate">{user.nickname}</span>
                    <span className="text-xs text-gray-400">@{user.id}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{user.bio}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">팔로워 {user.followers.toLocaleString()}명</p>
                </div>
                <Button 
                  variant={user.isFollowing ? "outline" : "default"}
                  size="sm"
                  className={user.isFollowing ? "rounded-xl h-8 px-3 border-gray-200" : "rounded-xl h-8 px-3 bg-green-500 hover:bg-green-600"}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 팔로우 로직
                  }}
                >
                  {user.isFollowing ? (
                    <Check className="w-4 h-4 text-gray-400" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="font-medium">검색 결과가 없습니다.</p>
              <p className="text-xs mt-1">다른 검색어를 입력해보세요.</p>
            </div>
          )}
        </div>
      </div>

      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Search;