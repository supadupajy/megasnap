import { Post } from '@/types';

const SAFE_FALLBACK = '/placeholder.svg';

export const getTierFromFollowers = (followers: number) => {
  if (followers >= 10000000) return 'diamond';
  if (followers >= 1000000) return 'gold';
  if (followers >= 100000) return 'silver';
  return 'none';
};

export const isValidProfileMediaUrl = (url: unknown): url is string => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (/content\s*\d+/i.test(clean)) return false;
  if (/post\s*content/i.test(clean)) return false;
  if (!clean.startsWith('http')) return false;
  return true;
};

interface MapDbToPostParams {
  post: any;
  authUserId?: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export const mapDbToProfilePost = ({
  post,
  authUserId,
  displayName,
  avatarUrl,
  followerCount,
  isLiked = false,
  isSaved = false,
}: MapDbToPostParams): Post => {
  const rawImage = isValidProfileMediaUrl(post.image_url) ? post.image_url : SAFE_FALLBACK;
  let rawImages = Array.isArray(post.images) && post.images.length > 0
    ? post.images.filter(isValidProfileMediaUrl)
    : [rawImage];

  if (rawImages.length === 0) rawImages = [rawImage];

  const isAd = post.content?.trim().startsWith('[AD]');
  let borderType: 'diamond' | 'gold' | 'silver' | 'popular' | 'none' = 'none';

  if (post.hot_since) {
    borderType = 'popular';
  } else if (!isAd) {
    borderType = getTierFromFollowers(followerCount) as 'diamond' | 'gold' | 'silver' | 'none';
  }

  let finalImage = isValidProfileMediaUrl(rawImage) ? rawImage : SAFE_FALLBACK;
  let finalImages = rawImages.filter(isValidProfileMediaUrl);

  if (finalImages.length === 0) finalImages = [finalImage];

  return {
    id: post.id,
    isAd,
    isGif: false,
    isInfluencer: !isAd && ['silver', 'gold', 'diamond'].includes(borderType),
    user_id: post.user_id,
    owner_id: post.user_id,
    user: {
      id: post.user_id,
      name: post.user_id === authUserId ? displayName : (post.profiles?.nickname || post.user_name || '탐험가'),
      avatar: post.user_id === authUserId ? avatarUrl : (post.profiles?.avatar_url || post.user_avatar || '/placeholder.svg'),
    },
    content: post.content?.replace(/^\[AD\]\s*/, '') || '',
    location: post.location_name || '알 수 없는 장소',
    lat: post.latitude,
    lng: post.longitude,
    latitude: post.latitude,
    longitude: post.longitude,
    likes: Number(post.likes || 0),
    commentsCount: 0,
    comments: [],
    image: finalImage,
    image_url: finalImage,
    images: finalImages,
    videoUrl: post.video_url,
    videoUrls: Array.isArray(post.video_urls) ? post.video_urls : undefined,
    isLiked,
    isSaved,
    createdAt: new Date(post.created_at),
    borderType,
    category: post.category || 'none',
  };
};

export const mapSavedAdToPost = ({
  ad,
  stats,
}: {
  ad: any;
  stats: any;
}): Post => {
  const adPostId = `ad-map-marker-${ad.id}`;
  const likesCount = stats?.[0]?.count || 0;
  const commentsCount = stats?.[1]?.count || 0;
  const isLiked = !!stats?.[2]?.data;

  return {
    id: adPostId,
    isAd: true,
    isGif: false,
    isInfluencer: false,
    user_id: '',
    owner_id: '',
    user: {
      id: '',
      name: ad.brand_name || '광고',
      avatar: ad.brand_logo_url || '/placeholder.svg',
    },
    content: ad.subtitle || ad.title || '',
    location: '',
    lat: ad.lat,
    lng: ad.lng,
    latitude: ad.lat,
    longitude: ad.lng,
    likes: likesCount,
    commentsCount,
    comments: [],
    image: ad.image_url || '/placeholder.svg',
    image_url: ad.image_url || '/placeholder.svg',
    images: ad.image_url ? [ad.image_url] : ['/placeholder.svg'],
    videoUrl: undefined,
    isLiked,
    isSaved: true,
    link_url: ad.link_url,
    createdAt: new Date(ad.updated_at || Date.now()),
    borderType: 'none',
    category: 'none',
  };
};