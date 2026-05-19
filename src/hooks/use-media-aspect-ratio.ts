type MediaType = 'image' | 'video';

// 모든 포스팅 미디어는 9:16 비율로 고정 표시한다.
// (인자는 호환성을 위해 유지하되 사용하지 않음)
const FIXED_RATIO = '9 / 16';

export const useMediaAspectRatio = (_src?: string | null, _type: MediaType = 'image') => {
  return FIXED_RATIO;
};
