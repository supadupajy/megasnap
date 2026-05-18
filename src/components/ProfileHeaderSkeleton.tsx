"use client";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ProfileHeaderSkeleton = () => (
  <div className="p-6">
    <div className="flex items-center gap-6 mb-8">
      <Skeleton className="w-24 h-24 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-4 mt-4">
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-8 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-8 mx-auto" />
            <Skeleton className="h-3 w-14 mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-5 w-8 mx-auto" />
            <Skeleton className="h-3 w-14 mx-auto" />
          </div>
        </div>
      </div>
    </div>
    <Skeleton className="w-full h-11 rounded-xl mb-8" />
    <Skeleton className="h-px w-full mb-4" />
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, index) => (
        <Skeleton key={index} className="aspect-square rounded-sm" />
      ))}
    </div>
  </div>
);

export default ProfileHeaderSkeleton;