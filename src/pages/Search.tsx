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
import { MOCK_USERS } from '@/lib/mock-data';

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const navigate = useNavigate();

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return MOCK_USERS.slice(0, 10);
    return MOCK_USERS.filter(u => u.id.includes(query) || u.name.includes(query)).slice(0, 15);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <div className="pt-[88px] px-4">
        <div className="relative py-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="아이디 또는 닉네임 검색" 
              className="pl-10 h-12 bg-gray-50 border-none rounded-2xl focus-visible:ring-green-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            {searchQuery ? '검색 결과' : '추천 사용자'}
          </p>
          {filteredUsers.map((user) => (
            <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl cursor-pointer active:scale-[0.98] transition-all">
              <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-900 truncate">{user.nickname}</span>
                  <span className="text-[10px] text-gray-400">@{user.id}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{user.bio}</p>
              </div>
              <Button variant={user.isFollowing ? "outline" : "default"} size="sm" className="rounded-xl h-8 px-3">
                {user.isFollowing ? <Check className="w-4 h-4 text-gray-400" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <BottomNav onWriteClick={() => setIsWriteOpen(true)} />
      <WritePost isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)} />
    </div>
  );
};

export default Search;