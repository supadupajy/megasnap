import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Navigation, ShoppingBag, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleShare } from '@/utils/share';

interface PostActionsProps {
  postId: string;
  isLiked: boolean;
  isSaved: boolean;
  likesCount: number;
  commentsCount: number;
  isAd?: boolean;
  linkUrl?: string | null;
  lat?: number;
  lng?: number;
  adIcon?: 'shopping-bag' | 'external-link';
  className?: string;
  onLikeClick: (e: React.MouseEvent) => void;
  onCommentClick: (e: React.MouseEvent) => void;
  onSaveClick: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
}

const PostActions = ({
  postId,
  isLiked,
  isSaved,
  likesCount,
  commentsCount,
  isAd = false,
  linkUrl,
  lat,
  lng,
  adIcon = 'shopping-bag',
  className,
  onLikeClick,
  onCommentClick,
  onSaveClick,
  onLocationClick,
}: PostActionsProps) => {
  const AdIcon = adIcon === 'shopping-bag' ? ShoppingBag : ExternalLink;
  const adIconClassName = adIcon === 'shopping-bag' ? 'w-3.5 h-3.5 fill-white' : 'w-3.5 h-3.5';

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-black transition-all active:scale-95',
              isLiked
                ? 'border-red-100 bg-red-50 text-red-500 shadow-sm shadow-red-100/50'
                : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'
            )}
            onClick={onLikeClick}
            aria-label={`좋아요 ${likesCount.toLocaleString()}개`}
          >
            <Heart className={cn('h-[18px] w-[18px] transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600')} />
            <span className="tabular-nums leading-none">{likesCount.toLocaleString()}</span>
          </button>
          <button
            type="button"
            onClick={onCommentClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 text-sm font-black text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
            aria-label={`댓글 ${commentsCount.toLocaleString()}개`}
          >
            <MessageCircle className="h-[18px] w-[18px] text-gray-600" />
            <span className="tabular-nums leading-none">{commentsCount.toLocaleString()}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleShare(e, postId)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
            aria-label="공유하기"
          >
            <Share2 className="h-[18px] w-[18px] text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 transition-all hover:bg-gray-100 active:scale-95"
            onClick={onSaveClick}
            aria-label="저장하기"
          >
            <Bookmark className={cn('h-[18px] w-[18px] transition-colors', isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-600')} />
          </button>
          {isAd && (
            <a
              href={linkUrl ? (linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`) : 'https://s.baemin.com/t3000fBqlbHGL'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-9 items-center justify-center gap-1.5 px-3 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md border border-[#2AC1BC]/20 shrink-0 whitespace-nowrap"
            >
              <AdIcon className={adIconClassName} />
              <span className="text-[10px] font-black leading-none">보러가기</span>
            </a>
          )}
          {lat !== undefined && lng !== undefined && onLocationClick && (
            <button
              type="button"
              onClick={(e) => onLocationClick(e, lat, lng)}
              className="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-full active:scale-95 transition-all shrink-0 whitespace-nowrap"
              style={{ backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', isolation: 'isolate' }}
            >
              <Navigation className="w-3.5 h-3.5" style={{ fill: '#4f46e5', color: '#4f46e5', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', lineHeight: 1 }}>위치보기</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostActions;
