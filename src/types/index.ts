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
  user: User;
  content: string;
  location: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number; // legacy/calculated field
  lng?: number; // legacy/calculated field
  likes: number;
  commentsCount: number;
  comments: Comment[];
  image: string;
  image_url?: string;
  images: string[];
  isLiked: boolean;
  isAd: boolean;
  isGif: boolean;
  isInfluencer?: boolean;
  borderType?: 'gold' | 'silver' | 'none' | 'popular' | 'diamond';
  youtubeUrl?: string;
  videoUrl?: string;
  category?: string;
  isSaved?: boolean;
  rank?: number; // for trending/popular lists
  createdAt: Date;
  isNewRealtime?: boolean;
}