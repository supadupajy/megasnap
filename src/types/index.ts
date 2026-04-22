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
  borderType?: 'gold' | 'silver' | 'none';
  youtubeUrl?: string;
  videoUrl?: string;
  category?: string;
  isSaved?: boolean;
}