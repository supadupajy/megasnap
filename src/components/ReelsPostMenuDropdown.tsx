import React from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Reels(영상 풀스크린) 전용 3-dot 메뉴 — 내 포스팅에서만 표시.
 * 어두운 영상 위에 얹히는 디자인이라 트리거는 반투명 다크 캡슐.
 * 드롭다운 컨텐츠는 ReelsViewer의 z-index(9999)보다 위로 떠야 한다.
 */
interface ReelsPostMenuDropdownProps {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

const ReelsPostMenuDropdown: React.FC<ReelsPostMenuDropdownProps> = ({
  onEdit,
  onDelete,
  className,
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="포스팅 메뉴"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className={cn(
            'w-9 h-9 rounded-full bg-black/45 backdrop-blur-md',
            'flex items-center justify-center border border-white/10',
            'active:scale-95 transition-transform',
            className
          )}
        >
          <MoreVertical className="w-4 h-4 text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          'w-36 rounded-2xl p-1.5 shadow-2xl border-gray-100 bg-white/95 backdrop-blur-md',
          // ReelsViewer(포털, z=9999)보다 위로
          'z-[10100]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-indigo-50 outline-none"
        >
          <Pencil className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-indigo-600">수정하기</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
          <span className="text-sm font-bold text-red-600">삭제하기</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ReelsPostMenuDropdown;
