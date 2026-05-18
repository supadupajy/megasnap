"use client";

import React from 'react';
import { Map } from 'lucide-react';

import PostItem from '@/components/PostItem';
import ProfileGridThumbnail from '@/components/ProfileGridThumbnail';
import { Post } from '@/types';
import { ProfileViewMode } from '@/components/ProfileTabs';

interface ProfilePostsContentProps {
  viewMode: ProfileViewMode;
  posts: Post[];
  onViewOnMap: () => void;
  onGridItemClick: (postId: string) => void;
  onLikeToggle: (postId: string) => void;
  onSaveToggle: (postId: string, nextSaved: boolean) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number, post: Post) => void;
  onDelete: (postId: string) => void;
  onOwnUserClick: () => void;
  onImageError: (postId: string) => void;
}

const ProfilePostsContent = ({
  viewMode,
  posts,
  onViewOnMap,
  onGridItemClick,
  onLikeToggle,
  onSaveToggle,
  onLocationClick,
  onDelete,
  onOwnUserClick,
  onImageError,
}: ProfilePostsContentProps) => {
  return (
    <>
      <div
        onClick={onViewOnMap}
        className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 mb-4 cursor-pointer active:bg-indigo-100 transition-colors"
      >
        <h3 className="text-sm font-black text-indigo-600 flex items-center gap-2">
          <Map className="w-4 h-4 fill-indigo-600" />
          지도에서 보기
        </h3>
        <p className="text-[10px] text-indigo-400 font-bold mt-0.5">나의 추억들을 지도에서 확인하세요</p>
      </div>

      <div className={viewMode === 'list' ? undefined : 'hidden'}>
        {posts.map((post) => (
          <div key={post.id} id={`post-${post.id}`}>
            <PostItem
              post={post}
              disablePulse={true}
              autoPlayVideo={true}
              onLikeToggle={() => onLikeToggle(post.id)}
              onSaveToggle={onSaveToggle}
              onLocationClick={(e, lat, lng) => onLocationClick(e, lat, lng, post)}
              onDelete={() => onDelete(post.id)}
              onOwnUserClick={onOwnUserClick}
            />
          </div>
        ))}
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-1 px-6' : 'hidden'}>
        {posts.map((post) => (
          <div key={post.id} onClick={() => onGridItemClick(post.id)}>
            <ProfileGridThumbnail
              post={post}
              onError={() => onImageError(post.id)}
            />
          </div>
        ))}

        {posts.length === 0 && (
          <div className="col-span-3 py-20 text-center text-gray-400 font-medium">아직 등록된 컨텐츠가 없습니다.</div>
        )}
      </div>
    </>
  );
};

export default ProfilePostsContent;