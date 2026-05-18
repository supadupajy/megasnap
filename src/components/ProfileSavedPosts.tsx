"use client";

import React from 'react';

import PostItem from '@/components/PostItem';
import { Post } from '@/types';

interface ProfileSavedPostsProps {
  posts: Post[];
  onLikeToggle: (postId: string) => void;
  onSaveToggle: (postId: string, nextSaved: boolean) => void;
  onLocationClick: (e: React.MouseEvent, lat: number, lng: number, post: Post) => void;
  onOwnUserClick: () => void;
}

const ProfileSavedPosts = ({
  posts,
  onLikeToggle,
  onSaveToggle,
  onLocationClick,
  onOwnUserClick,
}: ProfileSavedPostsProps) => {
  if (posts.length === 0) {
    return <div className="py-20 text-center text-gray-400 font-medium">저장된 컨텐츠가 없습니다.</div>;
  }

  return (
    <>
      {posts.map((post) => (
        <div key={post.id} id={`post-saved-${post.id}`}>
          <PostItem
            post={post}
            disablePulse={true}
            autoPlayVideo={true}
            onLikeToggle={() => onLikeToggle(post.id)}
            onSaveToggle={onSaveToggle}
            onLocationClick={(e, lat, lng) => onLocationClick(e, lat, lng, post)}
            onOwnUserClick={onOwnUserClick}
          />
        </div>
      ))}
    </>
  );
};

export default ProfileSavedPosts;