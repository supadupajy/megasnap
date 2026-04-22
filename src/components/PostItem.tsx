"use client";

import React, { useState, useEffect } from 'react';
import { Post } from '@/types';
import { getFallbackImage } from '@/lib/utils';
import { Heart, MapPin, MessageCircle, Share2, MoreHorizontal, Navigation, Utensils, Car, TreePine, PawPrint, Send, ChevronDown, ChevronUp, Bookmark, ShoppingBag, AlertCircle, Ban, Trash2, Play, ExternalLink } from 'lucide-react';
import { cn, getYoutubeId } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Comment } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { fetchCommentsByPostId, insertComment, isPersistedPostId } from '@/utils/comments';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface PostItemProps {
  post: Post;
  onLikeToggle?: (e: React.MouseEvent) => void;
  onDelete?: (postId: string) => void;
  onCommentClick?: (e: React.MouseEvent, comment: Comment) => void;
  onLocationClick?: (e: React.MouseEvent, lat: number, lng: number) => void;
  onShare?: (e: React.MouseEvent) => void;
  onSave?: (e: React.MouseEvent) => void;
}

const PostItem = ({ post, onLikeToggle, onDelete, onCommentClick, onLocationClick, onShare, onSave }: PostItemProps) => {
  const [imgError, setImgError] = useState(false);
  const { user: authUser } = useAuth();
  
  const displayImage = imgError ? getFallbackImage(post.id) : post.image;

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm mb-4">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={(e) => e.stopPropagation()}>
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600 transition-transform group-active:scale-90">
            <img 
              src={post.user.avatar} 
              alt={post.user.name} 
              className="w-full h-full rounded-full object-cover border-2 border-white" 
              onError={(e) => (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80"} 
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 leading-none group-hover:text-indigo-600 transition-colors">
                {post.user.name}
              </p>
            </div>
            <div className="flex items-center text-indigo-600 gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /><span className="text-[10px] font-medium">{post.location}</span></div>
          </div>
        </div>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="text-gray-400 p-1 outline-none" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-5 h-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40 rounded-2xl p-2 shadow-xl border-gray-100 bg-white/95 backdrop-blur-md z-[60]">{isMine ? (<DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Trash2 className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">삭제하기</span></DropdownMenuItem>) : (<><DropdownMenuItem onClick={(e) => { e.stopPropagation(); showSuccess('신고가 접수되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-gray-50 outline-none"><AlertCircle className="w-4 h-4 text-gray-600" /><span className="text-sm font-bold text-gray-700">신고</span></DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); blockUser(user.id); showError('차단되었습니다.'); }} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer focus:bg-red-50 outline-none"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm font-bold text-red-600">차단</span></DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu>
      </div>

      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img 
          src={displayImage} 
          alt={post.content}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          onError={() => {
            console.log(`[PostItem] Image failed to load, replacing with fallback: ${post.id}`);
            setImgError(true);
          }}
        />
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4 pt-1.5"><button className="transition-transform active:scale-125" onClick={handleLikeToggleLocal}><Heart className={cn("w-6 h-6 transition-colors", isLiked ? 'fill-red-500 text-red-500' : 'text-gray-700')} /></button><button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><MessageCircle className="w-6 h-6 text-gray-700" /></button><button onClick={(e) => e.stopPropagation()}><Share2 className="w-6 h-6 text-gray-700" /></button></div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              {/* 저장 버튼 (북마크) */}
              <button className="transition-transform active:scale-125" onClick={handleSaveToggle}>
                <Bookmark className={cn("w-6 h-6 transition-colors", isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-700')} />
              </button>
              
              {/* 카테고리 뱃지 */}
              {renderCategoryBadge()}
              
              {/* 위치보기 버튼 */}
              {lat !== undefined && lng !== undefined && (
                <button onClick={handleLocationClick} className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100">
                  <Navigation className="w-3.5 h-3.5 fill-indigo-600" />
                  <span className="text-[10px] font-black">위치보기</span>
                </button>
              )}
            </div>
            {isAd && (
              <a 
                href="https://s.baemin.com/t3000fBqlbHGL" 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()} 
                className="flex items-center justify-center gap-1.5 w-[82px] py-1.5 bg-[#2AC1BC] text-white rounded-full hover:opacity-90 active:scale-95 transition-all shadow-sm border border-[#2AC1BC]/20"
              >
                <ShoppingBag className="w-3.5 h-3.5 fill-white" />
                <span className="text-[10px] font-black">주문하기</span>
              </a>
            )}
          </div>
        </div>
        <div className="space-y-1"><p className="text-sm font-bold text-gray-500">좋아요 {likesCount.toLocaleString()}개</p><div className="flex gap-2 items-start"><div className="flex items-center gap-1.5 shrink-0"><span className="text-sm font-bold text-gray-900 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleUserClick}>{user.name}</span>{isAd && <span className="bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm leading-none">Ad</span>}</div><p className="text-sm text-gray-800 leading-snug line-clamp-2">{content}</p></div><form onSubmit={handleAddComment} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-3 mb-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100"><Input placeholder="댓글 달기..." className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={isSubmittingComment} /><button type="submit" disabled={!commentInput.trim() || isSubmittingComment} className="text-indigo-600 disabled:text-gray-300 transition-colors"><Send className="w-4 h-4" /></button></form>{lastComment && (<div className="flex gap-2 items-start mt-1"><span className="font-bold text-sm text-gray-900">{lastComment.user}</span><span className="text-sm text-gray-500 line-clamp-1">{lastComment.text}</span></div>)}<button className="w-full py-1 flex items-center justify-between group" onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}><span className="text-xs text-gray-400 font-medium">{showComments ? '댓글 닫기' : `댓글 ${localComments.length.toLocaleString()}개 모두 보기`}</span>{showComments ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}</button><AnimatePresence>{showComments && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">{localComments.slice(0, -1).map((c, i) => (<div key={i} className="flex gap-2 items-start"><span className="font-bold text-sm text-gray-900">{c.user}</span><span className="text-sm text-gray-500 line-clamp-1">{c.text}</span></div>))}</motion.div>)}</AnimatePresence></div>
      </div>
      <DeleteConfirmDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PostItem;