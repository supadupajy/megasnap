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
  isGif?: boolean; // GIF 여부 추가
  user: User;
  content: string;
  location: string;
  lat: number;
  lng: number;
  likes: number;
  image: string;
  isLiked: boolean;
  createdAt: Date;
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
}