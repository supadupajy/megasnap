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
  is_seed_data?: boolean;
  owner_id?: string; // 실제 DB user_id (RLS 소유자 판별용, mapRawToPost에서 p.user_id로 설정)
  display_user_id?: string; // 화면 표시용 유저 ID (시드 데이터에서 다른 유저 ID)
}