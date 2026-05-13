import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark, ShoppingBag, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleShare } from '@/utils/share';
import LocationButtonWithTimer from './LocationButtonWithTimer';

interface PostActionsProps {
  postId: string;
  isLiked: boolean;
  isSaved: boolean;
  likesCount: number;
  commentsCount: number;
  hasUserCommented?: boolean;
  isAd?: boolean;
  linkUrl?: string | null;
  lat?: number;
  lng?: number;
  /** 포스트의 생성 시각 (광고 아닌 경우 24h 만료 룰 적용) */
  createdAt?: Date | string | number | null;
  adIcon?: 'shopping-bag' | 'external-link';
  className?: string;
  adFooterContent?: React.ReactNode;
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
  hasUserCommented = false,
  isAd = false,
  linkUrl,
  lat,
  lng,
  createdAt,
  adIcon = 'shopping-bag',
  className,
  adFooterContent,
  onLikeClick,
  onCommentClick,
  onSaveClick,
  onLocationClick,
}: PostActionsProps) => {
  const AdIcon = adIcon === 'shopping-bag' ? ShoppingBag : ExternalLink;
  const adIconClassName = adIcon === 'shopping-bag' ? 'w-3.5 h-3.5 fill-white' : 'w-3.5 h-3.5';
  const adHref = linkUrl ? (linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`) : 'https://s.baemin.com/t3000fBqlbHGL';
  const hasValidLocation = typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
  const canShowLocation = hasValidLocation && onLocationClick;
  const shouldShowLocationUnavailable = !isAd && !!onLocationClick && !hasValidLocation;

  const saveButton = (
    <button
      type="button"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 transition-all hover:bg-gray-100 active:scale-95"
      onClick={onSaveClick}
      aria-label="저장하기"
    >
      <Bookmark className={cn('h-[18px] w-[18px] transition-colors', isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-600')} />
    </button>
  );

  const adButton = isAd ? (
    <a
      href={adHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-9 items-center justify-center gap-1.5 px-3 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-md border border-[#2AC1BC]/20 shrink-0 whitespace-nowrap"
    >
      <AdIcon className={adIconClassName} />
      <span className="text-[10px] font-black leading-none">보러가기</span>
    </a>
  ) : null;

  const locationButton = canShowLocation ? (
    <LocationButtonWithTimer
      createdAt={createdAt}
      isAd={isAd}
      onClick={(e) => onLocationClick(e, lat as number, lng as number)}
      variant="light"
    />
  ) : shouldShowLocationUnavailable ? (
    <LocationButtonWithTimer
      createdAt={null}
      unavailable
      onClick={(e) => e.stopPropagation()}
      variant="light"
    />
  ) : null;

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
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-black transition-all active:scale-95',
              hasUserCommented
                ? 'border-indigo-100 bg-indigo-50 text-indigo-500 shadow-sm shadow-indigo-100/50'
                : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'
            )}
            aria-label={`댓글 ${commentsCount.toLocaleString()}개`}
          >
            <MessageCircle className={cn('h-[18px] w-[18px] transition-colors', hasUserCommented ? 'fill-indigo-500 text-indigo-500' : 'text-gray-600')} />
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

        <div className="flex shrink-0 items-center gap-2">
          {saveButton}
          {isAd && canShowLocation && adFooterContent ? locationButton : null}
          {isAd && canShowLocation && adFooterContent ? null : (
            isAd && canShowLocation ? (
              <div className="flex flex-col items-end gap-2">
                {locationButton}
                {adButton}
              </div>
            ) : (
              <>
                {adButton}
                {locationButton}
              </>
            )
          )}
        </div>
      </div>

      {isAd && canShowLocation && adFooterContent && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pt-1">
            {adFooterContent}
          </div>
          {adButton}
        </div>
      )}
    </div>
  );
};

export default PostActions;