export interface User {
  id: string;
  name: string;
  nickname?: string;
  avatar: string;
  bio?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  rank?: number;
  isAd?: boolean;
  isInfluencer?: boolean;
  isGif?: boolean;
  category?: 'food' | 'accident' | 'place' | 'animal' | 'none';
  user: User;
  content: string;
  location: string;
  lat: number;
  lng: number;
  likes: number;
  image: string;
  images?: string[];
  videoUrl?: string; // 비디오 광고를 위한 필드 추가
  adImageIndex?: number;
  isLiked: boolean;
  createdAt: Date;
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
}