export interface User {
  id: string;
  name: string;
  avatar: string;
  avatar_url?: string;
  nickname?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
  is_verified?: boolean;
}

export interface Comment {
  user: string;
  text: string;
}

export interface Post {
  id: string;
  user_id?: string;
  isAd?: boolean;
  isGif?: boolean;
  isInfluencer?: boolean;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  location: string;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  likes: number;
  commentsCount: number;
  comments: Comment[];
  image: string;
  image_url: string;
  images: string[];
  isLiked: boolean;
  isSaved?: boolean;
  youtubeUrl?: string;
  videoUrl?: string;
  category: string;
  createdAt: Date;
  borderType?: string;
  isNewRealtime?: boolean;
  is_seed_data?: boolean; // [NEW] 시드 데이터 여부 추가
}