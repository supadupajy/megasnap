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
  adImageIndex?: number;
  isLiked: boolean;
  isSaved?: boolean;
  createdAt: Date;
  borderType?: 'popular' | 'silver' | 'gold' | 'none';
}