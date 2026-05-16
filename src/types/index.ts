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
  id?: string;
  userId?: string;
  user: string;
  text: string;
  createdAt?: Date;
  likesCount?: number;
  isLiked?: boolean;
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
  hasUserCommented?: boolean; // 현재 로그인 사용자가 이 포스트에 댓글을 남겼는지 여부
  videoUrl?: string;
  videoUrls?: (string | null)[];

  category: string;
  createdAt: Date;
  borderType?: string;
  isNewRealtime?: boolean;
  owner_id?: string; // 실제 DB user_id (RLS 소유자 판별용, mapRawToPost에서 p.user_id로 설정)
  hot_since?: string | null; // 최근 1시간 좋아요 기준 HOT 마일스톤 시각
  likes_per_hour?: number; // 최근 1시간 내 좋아요 증가량 (HOT/트렌딩 판별용)
  views_per_hour?: number; // 최근 1시간 내 유효 조회수 (트렌딩 판별용)
  trending_score?: number; // 좋아요 점수 + 조회수 점수
  like_score?: number; // 최근 1시간 좋아요 순위 점수
  view_score?: number; // 최근 1시간 조회수 순위 점수
  user_followers?: number; // 작성자 follower 수 (tier 판별용)
  hashtags?: string[]; // 본문에서 추출된 검색용 해시태그

  link_url?: string; // 광고 랜딩 URL
  isAdPending?: boolean; // 광고 시작 시간 전 대기 중 (반투명 마커 표시용)
  isFriendPost?: boolean; // 친구(팔로잉) 포스팅 여부 (인기 탭 혼합 시 구분용)
}