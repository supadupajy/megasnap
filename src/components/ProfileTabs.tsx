"use client";

import React from 'react';
import { Bookmark, LayoutGrid, List } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ProfileViewMode = 'grid' | 'saved' | 'list';

interface ProfileTabsProps {
  viewMode: ProfileViewMode;
  onChange: (mode: ProfileViewMode) => void;
}

const ProfileTabs = ({ viewMode, onChange }: ProfileTabsProps) => {
  return (
    <div className="flex border-b border-gray-100">
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px',
          viewMode === 'grid' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-300'
        )}
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="text-xs font-bold">그리드</span>
      </button>

      <button
        onClick={() => onChange('list')}
        className={cn(
          'flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px',
          viewMode === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-300'
        )}
      >
        <List className="w-4 h-4" />
        <span className="text-xs font-bold">리스트</span>
      </button>

      <button
        onClick={() => onChange('saved')}
        className={cn(
          'flex-1 py-3 flex items-center justify-center gap-1.5 transition-all border-b-2 -mb-px',
          viewMode === 'saved' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-300'
        )}
      >
        <Bookmark className="w-4 h-4" />
        <span className="text-xs font-bold">저장됨</span>
      </button>
    </div>
  );
};

export default ProfileTabs;