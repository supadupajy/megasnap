"use client";

import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Heart, MessageCircle, Share2, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostDetailProps {
  post: any | null;
  isOpen: boolean;
  onClose: () => void;
}

const PostDetail = ({ post, isOpen, onClose }: PostDetailProps) => {
  if (!post) return null;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full my-4" />
        <div className="overflow-y-auto px-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={post.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="font-bold text-gray-900">{post.user.name}</p>
                <div className="flex items-center text-green-500 gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs font-medium">{post.location}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-gray-100">
            <img src={post.image} alt="" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button className="flex items-center gap-1.5 text-gray-600">
              <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm font-medium">{post.likes}</span>
            </button>
            <button className="flex items-center gap-1.5 text-gray-600">
              <MessageCircle className="w-6 h-6" />
              <span className="text-sm font-medium">12</span>
            </button>
            <button className="ml-auto text-gray-600">
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          <p className="text-gray-800 leading-relaxed mb-6">
            {post.content}
          </p>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">댓글 2개</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <span className="font-bold text-xs">여행가_A</span>
                <span className="text-xs text-gray-600">와 여기 진짜 가보고 싶었는데! 정보 감사합니다.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-xs">SeoulLife</span>
                <span className="text-xs text-gray-600">날씨 좋을 때 가면 최고죠 ㅎㅎ</span>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PostDetail;