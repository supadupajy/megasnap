import React from 'react';
import { MoreHorizontal, Pencil, Trash2, AlertCircle, Ban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useBlockedUsers } from '@/hooks/use-blocked-users';

interface PostMenuDropdownProps {
  isMine: boolean;
  isAdmin: boolean;
  isAd: boolean;
  postOwnerId?: string;
  zIndexClass?: string;
  onEdit?: (e: React.SyntheticEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onAfterBlock?: () => void;
  reportMessage?: string;
}

const PostMenuDropdown = ({
  isMine,
  isAdmin,
  isAd,
  postOwnerId,
  zIndexClass = 'z-[200]',
  onEdit,
  onDelete,
  onAfterBlock,
  reportMessage = '신고가 접수되었습니다.',
}: PostMenuDropdownProps) => {
  const { blockUser } = useBlockedUsers();
  const [open, setOpen] = React.useState(false);
  const lastEditRunAtRef = React.useRef(0);

  const runEdit = (e: React.SyntheticEvent) => {
    const now = Date.now();
    if (now - lastEditRunAtRef.current < 300) return;
    lastEditRunAtRef.current = now;
    e.stopPropagation();
    (window as any).__tocaCaptureEditMapDebug?.('edit-menu-runEdit-before-close');
    setOpen(false);
    onEdit?.(e);
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          'w-36 rounded-2xl p-1.5 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md',
          zIndexClass
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {(isMine || isAdmin) ? (
          <>
            {!isAd && isMine && onEdit && (
              <DropdownMenuItem
                onPointerDown={runEdit}
                onSelect={(e) => runEdit(e as unknown as React.SyntheticEvent)}
                onClick={runEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-indigo-50 outline-none"
              >
                <Pencil className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-indigo-600">수정하기</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(e);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-600">삭제하기</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                showSuccess(reportMessage);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"
            >
              <AlertCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-bold text-gray-700">신고</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                if (postOwnerId) blockUser(postOwnerId);
                showError('차단되었습니다.');
                onAfterBlock?.();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer focus:bg-red-50 outline-none"
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-600">차단</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PostMenuDropdown;
