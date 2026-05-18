import { Post } from '@/types';

export type PostMediaItem =
  | { type: 'image'; url: string }
  | { type: 'video'; url: string; posterUrl?: string };

export const isValidMediaUrl = (url: unknown): url is string => {
  return typeof url === 'string' && url.trim().startsWith('http');
};

export const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|m4v)(\?|#|$)/i.test(url);
};

export const isGeneratedVideoThumbnailUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  try {
    return /-thumb\.(jpe?g|png|webp)(\?|#|$)/i.test(new URL(url).pathname);
  } catch {
    return /-thumb\.(jpe?g|png|webp)(\?|#|$)/i.test(url);
  }
};

const getTrustedPosterUrl = (url: string | undefined): string | undefined => {
  if (!isValidMediaUrl(url)) return undefined;
  return isGeneratedVideoThumbnailUrl(url) ? undefined : url;
};

export interface GetPostMediaItemsOptions {
  /**
   * true이면 `-thumb.*` 패턴의 자동 생성 썸네일도 비디오 포스터로 신뢰한다.
   * 프로필 그리드처럼 실제 `<video>`를 마운트하지 않고 정지 이미지만 보여줄 때 사용.
   */
  trustGeneratedVideoThumbnails?: boolean;
}

export const getPostMediaItems = (
  post: Post | any,
  options: GetPostMediaItemsOptions = {}
): PostMediaItem[] => {
  if (!post) return [];

  const { trustGeneratedVideoThumbnails = false } = options;

  const resolvePoster = (url: string | undefined): string | undefined => {
    if (trustGeneratedVideoThumbnails) {
      return isValidMediaUrl(url) ? url : undefined;
    }
    return getTrustedPosterUrl(url);
  };

  const rawImages = Array.isArray(post.images) ? post.images : [];
  const alignedImages = rawImages.map((url) => (isValidMediaUrl(url) ? url : undefined));
  const images = alignedImages.filter(isValidMediaUrl);
  const singleImage = isValidMediaUrl(post.image_url) ? post.image_url : isValidMediaUrl(post.image) ? post.image : undefined;

  if (post.isAd) {
    const adImage = singleImage ?? images[0];
    return adImage ? [{ type: 'image', url: adImage }] : [];
  }

  const rawVideoUrls = Array.isArray(post.videoUrls)
    ? post.videoUrls
    : Array.isArray(post.video_urls)
      ? post.video_urls
      : [];

  if (rawVideoUrls.length > 0) {
    const maxLength = Math.max(alignedImages.length, rawVideoUrls.length);
    const items: PostMediaItem[] = [];

    for (let index = 0; index < maxLength; index += 1) {
      const videoUrl = rawVideoUrls[index];
      const imageUrl = alignedImages[index];

      if (isValidMediaUrl(videoUrl)) {
        items.push({ type: 'video', url: videoUrl, posterUrl: resolvePoster(imageUrl) });
      } else if (isValidMediaUrl(imageUrl)) {
        items.push({ type: 'image', url: imageUrl });
      }
    }

    if (items.length > 0) return items;
  }

  if (isValidMediaUrl(post.videoUrl) || isValidMediaUrl(post.video_url)) {
    const videoUrl = (post.videoUrl || post.video_url) as string;
    return [{ type: 'video', url: videoUrl, posterUrl: resolvePoster(singleImage ?? images[0]) }];
  }

  const imageItems = (images.length > 0 ? images : singleImage ? [singleImage] : [])
    .filter((url) => !isVideoUrl(url))
    .map((url) => ({ type: 'image' as const, url }));

  if (imageItems.length > 0) return imageItems;

  const videoImage = (images.length > 0 ? images : singleImage ? [singleImage] : []).find(isVideoUrl);
  return videoImage ? [{ type: 'video', url: videoImage }] : [];
};