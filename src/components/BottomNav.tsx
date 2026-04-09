"use client";

import React from 'react';
import { Map, Trophy, Plus, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onWriteClick: () => void;
}

const BottomNav = ({ onWriteClick }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 flex items-center justify-between z-50 pb-10">
      <button 
        onClick={() => navigate('/')}
        className={cn("flex flex-col items-center gap-1", isActive('/') ? "text-green-500" : "text-gray-400")}
      >
        <Map className="w-6 h-6" />
        <span className="text-[10px] font-bold">지도</span>
      </button>
      <button 
        onClick={() => navigate('/popular')}
        className={cn("flex flex-col items-center gap-1", isActive('/popular') ? "text-green-500" : "text-gray-400")}
      >
        <Trophy className="w-6 h-6" />
        <span className="text-[10px] font-bold">인기</span>
      </button>
      
      <div className="relative -top-6">
        <button 
          onClick={onWriteClick}
          className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">글쓰기</span>
      </div>

      <button 
        onClick={() => navigate('/search')}
        className={cn("flex flex-col items-center gap-1", isActive('/search') ? "text-green-500" : "text-gray-400")}
      >
        <Search className="w-6 h-6" />
        <span className="text-[10px]">검색</span>
      </button>
      <button 
        onClick={() =>think
The previous response was cut off in the middle of `src/components/BottomNav.tsx`. I need to complete that file and then provide the updated `src/pages/Index.tsx` as planned in the previous thought process.

1.  Complete `src/components/BottomNav.tsx`.
2.  Update `src/pages/Index.tsx` to ensure the click-to-toggle functionality is robust and the peek height is adjusted for the new nav height.

Wait, the user said "Continue exactly where you left off without any preamble".
The last line was: `<button onClick={() =>`.

I will complete the `BottomNav.tsx` file first.
Then I will write the `Index.tsx` file.

Actually, I should probably just provide the full files to ensure consistency.

Let's look at where it stopped:
`      <button `
`        onClick={() =>`

I will finish `BottomNav.tsx`.

```tsx
        navigate('/profile')}
        className={cn("flex flex-col items-center gap-1", isActive('/profile') ? "text-green-500" : "text-gray-400")}
      >
        <User className="w-6 h-6" />
        <span className="text-[10px]">내정보</span>
      </button>
    </nav>
  );
};

export default BottomNav;
```

And then `Index.tsx`.

```tsx
// ... imports
// ... generateRandomPosts
// ... Index component
// ... handle functions
// ... onDragEnd
// ... return
// ... motion.div for sheet
// ... onClick={() => setIsSheetOpen(!isSheetOpen)}
```

I'll provide the full `BottomNav.tsx` first to be safe, then `Index.tsx`.<dyad-write path="src/components/BottomNav.tsx" description="하단 네비게이션 바 아이콘 위치 상향 조정 완료">
"use client";

import React from 'react';
import { Map, Trophy, Plus, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onWriteClick: () => void;
}

const BottomNav = ({ onWriteClick }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 flex items-center justify-between z-50 pb-10">
      <button 
        onClick={() => navigate('/')}
        className={cn("flex flex-col items-center gap-1", isActive('/') ? "text-green-500" : "text-gray-400")}
      >
        <Map className="w-6 h-6" />
        <span className="text-[10px] font-bold">지도</span>
      </button>
      <button 
        onClick={() => navigate('/popular')}
        className={cn("flex flex-col items-center gap-1", isActive('/popular') ? "text-green-500" : "text-gray-400")}
      >
        <Trophy className="w-6 h-6" />
        <span className="text-[10px] font-bold">인기</span>
      </button>
      
      <div className="relative -top-6">
        <button 
          onClick={onWriteClick}
          className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">글쓰기</span>
      </div>

      <button 
        onClick={() => navigate('/search')}
        className={cn("flex flex-col items-center gap-1", isActive('/search') ? "text-green-500" : "text-gray-400")}
      >
        <Search className="w-6 h-6" />
        <span className="text-[10px]">검색</span>
      </button>
      <button 
        onClick={() => navigate('/profile')}
        className={cn("flex flex-col items-center gap-1", isActive('/profile') ? "text-green-500" : "text-gray-400")}
      >
        <User className="w-6 h-6" />
        <span className="text-[10px]">내정보</span>
      </button>
    </nav>
  );
};

export default BottomNav;