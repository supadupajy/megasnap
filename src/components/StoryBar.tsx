"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { MOCK_STORIES } from '@/lib/mock-data';

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
              <div className={`p-[2.5px] rounded-full ${story.hasUpdate ? 'bg-gradient-to-tr from-yellow-400 to-indigo-600' : 'bg-gray-200'}`}>
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