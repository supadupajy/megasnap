"use client";

import React, { useState, useRef } from 'react';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Flame, Play, Star, Navigation, Utensils, Car, TreePine, Sparkles, PawPrint, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface PostItemProps {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  location: string;
  likes: number;
  image: string;
  images?: string[];
  adImageIndex?: number;
  lat?: number;
  lng?: number;
  isLiked?: boolean;
  isAd?: boolean;
  isGif?: boolean;
  isInfluencer?: boolean;
  isViewed?: boolean;
  category?: 'food' | 'accident' | 'place' | 'animal' | 'none';
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
  disablePulse?: boolean;
  onLikeToggle?: (e: React.MouseEvent) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
  onClick?: () => void;
}

const PostItem = ({ 
  user, 
  content, 
  location, 
  likes, 
  image, 
  images = [],
  adImageIndex,
  lat,
  lng,
  isLiked, 
  isAd, 
  isGif, 
  isInfluencer,
  isViewed,
  category = 'none',
  borderType = 'none',
  disablePulse = false,
  onLikeToggle,
  onLocationClick,
  onClick
}: PostItemProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([
    { user: "travel_lover", text: "와 여기 진짜 가보고 싶었는데! 정보 감사합니다." }
  ]);
  const [commentInput, setCommentInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isPopular = !isAd && borderType === 'popular';
  const displayImages = images.length > 0 ? images : [image];

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    setCurrentImageIndex(index);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = `https://picsum.photos/seed/${content.length}/800/800`;
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${user.id}`);
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat !== undefined && lng !== undefined && onLocationClick) {
      onLocationClick(e, lat, lng);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim()) return;
    setComments([...comments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
think
The user is pointing out that my previous response was cut off. I need to continue the code from where it stopped in `src/components/PostItem.tsx`.

Looking at the previous output:
```tsx
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim()) return;
    setComments([...comments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
```

I need to finish the `handleAddComment` function and the rest of the `PostItem.tsx` file, then also update `PostDetail.tsx` to match the requested behavior (comments appearing below, "Close comments" button at the bottom).

Wait, the user said "Continue exactly where you left off without any preamble".

The last line was `setCommentInput('');`.

I will continue from there.

Plan:
1. Finish `src/components/PostItem.tsx`.
2. Update `src/components/PostDetail.tsx` with the same logic.

Let's check the logic for `PostItem.tsx`:
- Comment input always visible.
- If `showComments` is false: show last comment + "View all comments" button.
- If `showComments` is true: show all comments + "Close comments" button at the bottom.

Actually, the user said: "When you press 'View all comments', make it appear below the existing comments, change 'View all comments' to 'Close comments' and place it at the very bottom. And when you press 'Close comments', make it go back to the original state."

So:
Initial state:
- Input
- Last comment
- "View all comments" button

Expanded state:
- Input
- All comments (including the one that was "last")
- "Close comments" button

Let's finish `PostItem.tsx`.

```tsx
  };

  const renderCategoryBadge = () => {
    // ...
  };

  return (
    <div ...>
      {/* ... header ... */}
      {/* ... image ... */}
      <div className="px-4 pt-3 pb-4">
        {/* ... actions ... */}
        <div className="space-y-1">
          {/* ... likes ... */}
          {/* ... content ... */}
          
          {/* Comment Input */}
          <form ...>...</form>

          <AnimatePresence mode="wait">
            {!showComments ? (
              <motion.div 
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {comments.length > 0 && (
                  <div className="flex gap-2 items-start mt-1">
                    <span className="font-bold text-sm text-gray-900">{comments[comments.length - 1].user}</span>
                    <span className="text-sm text-gray-500 line-clamp-1">{comments[comments.length - 1].text}</span>
                  </div>
                )}
                <button 
                  className="w-full py-1 flex items-center justify-between group"
                  onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
                >
                  <span className="text-xs text-gray-400 font-medium">
                    댓글 {comments.length + 11}개 모두 보기
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 py-2">
                  {comments.map((comment, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="font-bold text-sm text-gray-900">{comment.user}</span>
                      <span className="text-sm text-gray-500">{comment.text}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 items-start opacity-50">
                    <span className="font-bold text-sm text-gray-900">seoul_explorer</span>
                    <span className="text-sm text-gray-500">주차 공간은 넉넉한가요?</span>
                  </div>
                </div>
                <button 
                  className="w-full py-1 flex items-center justify-between group border-t border-gray-50 mt-2"
                  onClick={(e) => { e.stopPropagation(); setShowComments(false); }}
                >
                  <span className="text-xs text-gray-400 font-medium">댓글 닫기</span>
                  <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
```

Wait, I need to provide the full file content in `<dyad-write>` tags. I can't just "continue" text outside of tags if I want the code to be updated.

The user said "Continue exactly where you left off without any preamble". This usually implies they want the rest of the code block.

However, my instructions say: "Only use ONE <dyad-write> block per file that you write!" and "ALWAYS write the entire file. It needs to be a complete file."

So I should rewrite the whole file `src/components/PostItem.tsx` and `src/components/PostDetail.tsx`.

Let's do that.

Summary of changes:
1. `PostItem.tsx`:
   - `mb-2` for post spacing (reduced from `mb-4` or whatever it was, though it was already `mb-2` in the previous turn, I'll keep it `mb-1` or `mb-2` to ensure it's "half").
   - Comment input always at top of comment section.
   - If `!showComments`: show last comment + "View all comments" button.
   - If `showComments`: show all comments + "Close comments" button at bottom.
2. `PostDetail.tsx`:
   - Same logic for comments.

Wait, the user said "Continue exactly where you left off without any preamble". I will provide the full files now.

Actually, I'll just provide the full files.

One detail: "포스팅과 포스팅 사이 여백이 조금 넓은데 절반으로 줄여줘".
In `PostItem.tsx`, it was `mb-2`. I'll change it to `mb-1` or just keep it `mb-2` if it was already small. Let's check the original. It was `mb-2`. I'll try `mb-1`.

Wait, the user said "Continue exactly where you left off". I'll start the response with the code.

Actually, I'll just provide the full files as per the "ALWAYS write the entire file" rule.

```tsx
  };

  const renderCategoryBadge = () => {
    // ...
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white mb-1 last:mb-20 transition-all duration-500 cursor-pointer border-b border-gray-50",
        isInfluencer && "animate-influencer-float",
        isPopular && !disablePulse && "animate-hot-pulse"
      )}
    >
```

Let's go.};

  const renderCategoryBadge = () => {
    if (category === 'none') return null;
    
    let Icon = null;
    let bgColor = "";
    let label = "";

    switch (category) {
      case 'food': Icon = Utensils; bgColor = "bg-orange-500"; label = "맛집"; break;
      case 'accident': Icon = Car; bgColor = "bg-red-600"; label = "사고"; break;
      case 'place': Icon = TreePine; bgColor = "bg-green-600"; label = "명소"; break;
      case 'animal': Icon = PawPrint; bgColor = "bg-purple-600"; label = "동물"; break;
    }

    if (!Icon) return null;

    return (
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10",
        bgColor
      )}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white mb-1 last:mb-20 transition-all duration-500 cursor-pointer border-b border-gray-50",
        isInfluencer && "animate-influencer-float",
        isPopular && !disablePulse && "animate-hot-pulse"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleUserClick}
        >
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white" 
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">{user.name}</p>
              {isAd && (
                <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>
              )}
            </div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-medium">{location}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-gray-400" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className={cn(
          "relative aspect-square w-full rounded-2xl transition-all duration-500",
          isInfluencer ? "influencer-border-container" : (
            isAd ? "p-[2px] bg-blue-500 shadow-lg shadow-blue-500/20" : (
              isPopular ? "popular-border-container" : (
                borderType === 'silver' ? "p-[2px] bg-gradient-to-br from-gray-300 via-white to-gray-400 shadow-lg" : (
                  borderType === 'gold' ? "p-[2px] bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 shadow-lg" : ""
                )
              )
            )
          )
        )}>
          <div className={cn(
            "w-full h-full rounded-[14px] overflow-hidden bg-white relative z-10",
            isInfluencer && "shine-overlay"
          )}>
            <div 
              ref={scrollRef}
              onScroll={handleImageScroll}
              className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
            >
              {displayImages.map((img, idx) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                  <img
                    src={img}
                    alt={`post-${idx}`}
                    className="w-full h-full object-cover transition-all duration-700"
                    onError={handleImageError}
                  />
                  {idx === adImageIndex && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-500 text-white px-10 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">
                      AD
                    </div>
                  )}
                </div>
              ))}
            </div>

            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                {displayImages.map((_, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      currentImageIndex === idx ? "bg-white w-4" : "bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
          
          {isInfluencer ? (
            <div className="absolute top-4 left-4 z-20 bg-yellow-400 text-black px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-black/5">
              <Star className="w-3.5 h-3.5 fill-black" />
              INFLUENCER
            </div>
          ) : isAd ? (
            <div className="absolute top-4 left-4 z-20 bg-blue-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">
              AD
            </div>
          ) : isPopular && (
            <div className="absolute top-4 left-4 z-20 bg-red-500 text-white px-2.5 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">
              <Flame className="w-3.5 h-3.5 fill-white" />
              HOT
            </div>
          )}

          {isGif && (
            <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-white p-1.5 rounded-full shadow-lg border border-white/20">
              <Play className="w-3 h-3 fill-white" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button 
              className="transition-transform active:scale-125" 
              onClick={(e) => {
                e.stopPropagation();
                onLikeToggle?.(e);
              }}
            >
              <Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
            </button>
            <button onClick={(e) => e.stopPropagation()}>
              <MessageCircle className="w-6 h-6 text-gray-700" />
            </button>
            <button onClick={(e) => e.stopPropagation()}>
              <Share2 className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {renderCategoryBadge()}
            {lat !== undefined && lng !== undefined && (
              <button 
                onClick={handleLocationClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100"
              >
                <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                <span className="text-[10px] font-black">위치보기</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-500">좋아요 {likes.toLocaleString()}개</p>
          <div className="flex gap-2 items-start">
            <div className="flex items-center gap-1.5 shrink-0">
              <span 
                className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={handleUserClick}
              >
                {user.name}
              </span>
              {isAd && (
                <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>
              )}
            </div>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">
              {content}
            </p>
          </div>

          {/* 댓글 입력창 */}
          <form 
            onSubmit={handleAddComment}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"
          >
            <Input 
              placeholder="댓글 달기..." 
              className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs h-8"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!commentInput.trim()}
              className="text-indigo-600 disabled:text-gray-300 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <AnimatePresence mode="wait">
            {!showComments ? (
              <motion.div 
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {comments.length > 0 && (
                  <div className="flex gap-2 items-start mt-1">
                    <span className="font-bold text-sm text-gray-900">{comments[comments.length - 1].user}</span>
                    <span className="text-sm text-gray-500 line-clamp-1">{comments[comments.length - 1].text}</span>
                  </div>
                )}
                <button 
                  className="w-full py-1 flex items-center justify-between group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                >
                  <span className="text-xs text-gray-400 font-medium">
                    댓글 {comments.length + 11}개 모두 보기
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 py-2">
                  {comments.map((comment, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="font-bold text-sm text-gray-900">{comment.user}</span>
                      <span className="text-sm text-gray-500">{comment.text}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 items-start opacity-50">
                    <span className="font-bold text-sm text-gray-900">seoul_explorer</span>
                    <span className="text-sm text-gray-500">주차 공간은 넉넉한가요?</span>
                  </div>
                </div>
                <button 
                  className="w-full py-1 flex items-center justify-between group border-t border-gray-50 mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(false);
                  }}
                >
                  <span className="text-xs text-gray-400 font-medium">댓글 닫기</span>
                  <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PostItem;

<dyad-write path="src/components/PostDetail.tsx" description="상세 보기 댓글 펼치기/접기 로직 및 버튼 위치 수정">
"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame, Star, ChevronDown, ChevronUp, Utensils, Car, TreePine, Sparkles, Navigation, PawPrint, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface PostDetailProps {
  posts: any[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onViewPost?: (id: string) => void;
  onLikeToggle?: (postId: string) => void;
  onLocationClick?: (lat: number, lng: number) => void;
}

const INITIAL_COMMENTS = [
  { user: "travel_lover", text: "와 여기 진짜 가보고 싶었는데! 정보 감사합니다." },
  { user: "photo_master", text: "날씨 좋을 때 가면 최고죠 ㅎㅎ" },
  { user: "seoul_explorer", text: "주차 공간은 넉넉한가요?" },
  { user: "daily_snap", text: "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!" }
];

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80";

const PostDetail = ({ posts, initialIndex, isOpen, onClose, onViewPost, onLikeToggle, onLocationClick }: PostDetailProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [commentInput, setCommentInput] = useState('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitialized && initialIndex !== -1) {
      setCurrentIndex(initialIndex);
      setHasInitialized(true);
      setShowComments(false);
      setCurrentImageIndex(0);
      setComments(INITIAL_COMMENTS);
    }
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, initialIndex, hasInitialized]);

  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (isOpen && currentPost && onViewPost) {
      onViewPost(currentPost.id);
    }
    setShowComments(false);
    setCurrentImageIndex(0);
    
    if (imageScrollRef.current) {
      imageScrollRef.current.scrollLeft = 0;
    }
  }, [currentIndex, isOpen, onViewPost]);

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index !== currentImageIndex) {
      setCurrentImageIndex(index);
    }
  };

  const handleAddComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim()) return;
    setComments([...comments, { user: "Dyad_Explorer", text: commentInput }]);
    setCommentInput('');
  };

  if (!isOpen || posts.length === 0) return null;
  
  const post = posts[currentIndex];
  if (!post) return null;

  const images = post.images || [post.image];
  const isAd = post.isAd;
  const isPopular = !isAd && post.borderType === 'popular';
  const isInfluencer = !isAd && post.isInfluencer;
  const category = post.category || 'none';

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${post.user.id}`);
  };

  const renderCategoryBadge = () => {
    if (category === 'none') return null;
    let Icon = null;
    let bgColor = "";
    let label = "";
    switch (category) {
      case 'food': Icon = Utensils; bgColor = "bg-orange-500"; label = "맛집"; break;
      case 'accident': Icon = Car; bgColor = "bg-red-600"; label = "사고"; break;
      case 'place': Icon = TreePine; bgColor = "bg-green-600"; label = "명소"; break;
      case 'animal': Icon = PawPrint; bgColor = "bg-purple-600"; label = "동물"; break;
    }
    if (!Icon) return null;
    return (
      <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10", bgColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black">{label}</span>
      </div>
    );
  };

  const lastComment = comments[comments.length - 1];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/40 backdrop-blur-sm border-none shadow-none w-full h-full max-w-none overflow-hidden translate-x-0 translate-y-0 left-0 top-0 data-[state=open]:animate-none data-[state=closed]:animate-none outline-none"
        onClick={onClose}
      >
        <div className="absolute top-4 right-6 z-[110]">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="rounded-2xl bg-white/80 backdrop-blur-xl hover:bg-white text-indigo-600 shadow-xl border border-white/40 w-11 h-11 active:scale-90 transition-all"
          >
            <X className="w-6 h-6 stroke-[2.5px]" />
          </Button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                onClick={onClose}
                className={cn(
                  "w-full max-w-[420px] h-[82vh] flex flex-col bg-white rounded-[40px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative cursor-pointer",
                  isAd && "border-4 border-blue-500",
                  isPopular && "popular-border-container",
                  isInfluencer && "influencer-border-container"
                )}
              >
                {/* Status Bar */}
                {isInfluencer && (
                  <div className="h-10 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 flex items-center justify-center gap-2 shrink-0">
                    <Star className="w-4 h-4 fill-black" />
                    <span className="text-[11px] font-black text-black uppercase tracking-widest">Influencer Recommended</span>
                    <Star className="w-4 h-4 fill-black" />
                  </div>
                )}
                {isPopular && (
                  <div className="h-10 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 flex items-center justify-center gap-2 shrink-0">
                    <Flame className="w-4 h-4 fill-white text-white" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Real-time Hot Post</span>
                    <Flame className="w-4 h-4 fill-white text-white" />
                  </div>
                )}
                {isAd && (
                  <div className="h-10 bg-blue-500 flex items-center justify-center gap-2 shrink-0">
                    <Sparkles className="w-4 h-4 fill-white text-white" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Sponsored Content</span>
                    <Sparkles className="w-4 h-4 fill-white text-white" />
                  </div>
                )}

                <div className="flex-1 h-full overflow-hidden flex flex-col relative bg-white rounded-[36px]">
                  <div 
                    ref={scrollContainerRef} 
                    className="flex-1 h-full overflow-y-auto no-scrollbar overscroll-contain"
                  >
                    <div className="flex flex-col">
                      <div className="aspect-square w-full bg-gray-100 relative overflow-hidden shrink-0">
                        <div 
                          ref={imageScrollRef}
                          onScroll={handleImageScroll}
                          className="image-slider flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
                        >
                          {images.map((img: string, idx: number) => (
                            <div key={idx} className="w-full h-full shrink-0 snap-center [scroll-snap-stop:always] relative">
                              <img 
                                src={img} 
                                alt="" 
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                              />
                              {idx === post.adImageIndex && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-500 text-white px-10 h-7 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-lg border border-white/10">
                                  AD
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {images.length > 1 && (
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-30">
                            {images.map((_: any, idx: number) => (
                              <div key={idx} className={cn("w-1.5 h-1.5 rounded-full transition-all", currentImageIndex === idx ? "bg-white w-4" : "bg-white/40")} />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3.5">
                            <button className="flex items-center gap-1 group" onClick={(e) => { e.stopPropagation(); onLikeToggle?.(post.id); }}>
                              <Heart className={cn("w-[18px] h-[18px] transition-transform group-active:scale-125", post.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} />
                              <span className="text-[11px] font-bold text-gray-500">{post.likes}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="flex items-center gap-1">
                              <MessageCircle className="w-[18px] h-[18px] text-gray-400" />
                              <span className="text-[11px] font-bold text-gray-500">{comments.length}</span>
                            </button>
                            <button className="text-gray-400" onClick={(e) => e.stopPropagation()}><Share2 className="w-[18px] h-[18px]" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div onClick={(e) => e.stopPropagation()}>{renderCategoryBadge()}</div>
                            {post.lat !== undefined && post.lng !== undefined && (
                              <button onClick={(e) => { e.stopPropagation(); onLocationClick?.(post.lat, post.lng); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                                <span className="text-[10px] font-black">위치보기</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 shrink-0 cursor-pointer" onClick={handleUserClick}>
                            <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white" />
                          </div>
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-gray-900 text-sm leading-none truncate cursor-pointer" onClick={handleUserClick}>{post.user.name}</p>
                              {isAd && (
                                <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>
                              )}
                            </div>
                            <div className="flex items-center text-indigo-600 gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="text-[10px] font-bold truncate">{post.location}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-700 text-sm leading-relaxed mb-4 font-medium" onClick={(e) => e.stopPropagation()}>{post.content}</p>

                        <div className="border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
                          {/* 댓글 입력창 */}
                          <form 
                            onSubmit={handleAddComment}
                            className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"
                          >
                            <Input 
                              placeholder="댓글 달기..." 
                              className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs h-8"
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                            />
                            <button 
                              type="submit"
                              disabled={!commentInput.trim()}
                              className="text-indigo-600 disabled:text-gray-300 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>

                          <AnimatePresence mode="wait">
                            {!showComments ? (
                              <motion.div 
                                key="collapsed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                {lastComment && (
                                  <div className="flex gap-2 items-start mt-1 mb-2">
                                    <span className="font-bold text-[13px] text-gray-900">{lastComment.user}</span>
                                    <span className="text-[13px] text-gray-500 line-clamp-1">{lastComment.text}</span>
                                  </div>
                                )}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowComments(true); }} 
                                  className="w-full py-2 flex items-center justify-between group"
                                >
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">View All Comments</p>
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div 
                                key="expanded"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-4 py-3">
                                  {comments.map((comment, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                      <span className="font-bold text-[13px] text-gray-900">{comment.user}</span>
                                      <span className="text-[13px] text-gray-500">{comment.text}</span>
                                    </div>
                                  ))}
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowComments(false); }} 
                                  className="w-full py-2 flex items-center justify-between group border-t border-gray-50 mt-2"
                                >
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Close Comments</p>
                                  <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetail;