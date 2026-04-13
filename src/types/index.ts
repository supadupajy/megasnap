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
  user: User;
  content: string;
  location: string;
  lat: number;
  lng: number;
  likes: number;
  image: string;
  images?: string[]; // 여러 장의 이미지를 위한 배열 추가
  isLiked: boolean;
  createdAt: Date;
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
}