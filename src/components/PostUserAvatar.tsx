import { useState } from 'react';
import { getOptimizedMarkerImage } from '@/lib/utils';

interface PostUserAvatarProps {
  name?: string;
  avatar?: string | null;
  postId: string;
  userId?: string;
  isAd?: boolean;
  size?: 'sm' | 'md';
  optimize?: boolean;
  activePress?: boolean;
}

const PostUserAvatar = ({
  name,
  avatar,
  postId,
  userId,
  isAd = false,
  size = 'md',
  optimize = false,
  activePress = false,
}: PostUserAvatarProps) => {
  const [avatarError, setAvatarError] = useState(false);

  const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-9 h-9';
  const initial = (name || '?')[0].toUpperCase();
  const pressClass = activePress ? ' transition-transform group-active:scale-90' : '';
  const imageSrc = avatar
    ? optimize
      ? getOptimizedMarkerImage(avatar, userId || postId)
      : avatar
    : '';
  const imageProps = optimize
    ? { loading: 'lazy' as const, decoding: 'async' as const }
    : {};

  if (isAd) {
    // 광고: 흰 배경 원형에 로고 이미지 (object-contain)
    if (avatarError || !avatar) {
      return (
        <div className={`${sizeClass} rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm${pressClass}`}>
          <span className="text-gray-700 font-black text-[9px] text-center leading-tight px-0.5">{name}</span>
        </div>
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-white shrink-0 flex items-center justify-center border-2 border-gray-100 shadow-sm overflow-hidden${pressClass}`}>
        <img
          src={imageSrc}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setAvatarError(true)}
          {...imageProps}
        />
      </div>
    );
  }

  // 일반 포스트: 앰버/밝은 노랑 그라디언트 링 + 프로필 사진
  if (avatarError || !avatar) {
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-yellow-100 shrink-0 flex items-center justify-center border-2 border-white${pressClass}`}>
        <span className="text-amber-950 font-bold text-sm">{initial}</span>
      </div>
    );
  }
  return (
    <div className={`${sizeClass} rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-yellow-100 shrink-0 relative${pressClass}`}>
      <img
        src={imageSrc}
        alt={name}
        className="w-full h-full rounded-full object-cover border-2 border-white"
        onError={() => setAvatarError(true)}
        {...imageProps}
      />
    </div>
  );
};

export default PostUserAvatar;
