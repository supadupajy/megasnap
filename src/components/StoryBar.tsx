"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

const USERNAME_PARTS = [
  'pixel', 'snap', 'wander', 'cloud', 'urban', 'wild', 'blue', 'golden', 
  'mystic', 'vivid', 'silent', 'epic', 'nova', 'luna', 'atlas', 'flow'
];

const MOCK_STORIES = Array.from({ length: 15 }).map((_, i) => {
  const part1 = USERNAME_PARTS[Math.floor(Math.random() * USERNAME_PARTS.length)];
  const part2 = USERNAME_PARTS[Math.floor(Math.random() * USERNAME_PARTS.length)];
  const id = `${part1}_${part2}${i > 9 ? i : '0' + i}`;
  
  return {
    id,
    name: id,
    avatar: `https://i.pravatar.cc/150?u=${id}`,
    hasUpdate: Math.random() > 0.3
  };
});

const StoryBar = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-b border-gray-100 py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-4 px-4">
          {MOCK_STORIES.map((story) => (
            <div 
              key={story.id} 
              onClick={() => navigate(`/profile/${story.id}`)}
              className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className={`p-[2.5px] rounded-full ${story.hasUpdate ? 'bg-gradient-to-tr from-yellow-400 to-green-500' : 'bg-gray-200'}`}>
                <Avatar className="w-16 h-16 border-2 border-white">
                  <AvatarImage src={story.avatar} />
                  <AvatarFallback>{story.name[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[11px] font-medium text-gray-600 truncate w-16 text-center">
                {story.name}
              </span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );
};

export default StoryBar;