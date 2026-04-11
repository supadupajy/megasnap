"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Share2, MapPin, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PostDetailProps {
  post: any | null;
  isOpen: boolean;
  onClose: () => void;
}

const PostDetail = ({ post, isOpen, onClose }: PostDetailProps) => {
  if (!post) return null;

  const isPopular = post.borderType === 'popular';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "w-[92vw] sm:max-w-[400px] p-0 overflow-hidden rounded-[32px] bg-white shadow-2xl transition-all duration-300",
        isPopular ? "border-[4px] border-[#ccff00]" : "border-none"
      )}>
        <DialogHeader className="absolute top-4 right-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm"
          >
            <X className="w-5 h-5 text-gray-600" />
          </Button>
        </DialogHeader>

        <ScrollArea className="max-h-[85vh]">
          <div className="flex flex-col">
            {/* Image Section */}
            <div className="aspect-square w-full bg-gray-100 relative">
              <img 
                src={post.image} 
                alt="" 
                className="w-full h-full object-cover"
              />
              {isPopular && (
                <div className="absolute top-4 left-4 z-20 bg-[#ccff00] text-black px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg border border-black/5">
                  <Flame className="w-3 h-3 fill-black" />
                  HOT
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={post.user.avatar} 
                  alt="" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-green-50" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 leading-none">{post.user.name}</p>
                    {post.isAd && (
                      <a
                        href="https://s.baemin.com/t3000fBqlbHGL"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold hover:bg-blue-600 transition-colors"
                      >
                        앱에서 보기
                      </a>
                    )}
                  </div>
                  <div className="flex items-center text-green-500 gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[11px] font-bold">{post.location}</span>
                  </div>
                </div>

              </div>

              <p className="text-gray-700 text-sm leading-relaxed mb-6">
                {post.content}
              </p>

              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-50">
                <button className="flex items-center gap-1.5 text-gray-600 hover:text-red-500 transition-colors">
                  <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-xs font-bold">{post.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 text-gray-600 hover:text-blue-500 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-bold">12</span>
                </button>
                <button className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              {/* Comments Preview */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-wider">Comments</p>
                <div className="flex gap-2 items-start">
                  <span className="font-bold text-xs text-gray-900 whitespace-nowrap">여행가_A</span>
                  <span className="text-xs text-gray-500 leading-snug">와 여기 진짜 가보고 싶었는데! 정보 감사합니다.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="font-bold text-xs text-gray-900 whitespace-nowrap">SeoulLife</span>
                  <span className="text-xs text-gray-500 leading-snug">날씨 좋을 때 가면 최고죠 ㅎㅎ</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetail;