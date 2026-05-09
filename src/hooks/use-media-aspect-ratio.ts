type MediaType = 'image' | 'video';

const FIXED_RATIO = '3 / 4';

// 모든 포스팅 미디어는 3:4 비율로 고정 표시한다.
// (인자는 호환성을 위해 유지하되 사용하지 않음)
export const useMediaAspectRatio = (_src?: string | null, _type: MediaType = 'image') => {
  return FIXED_RATIO;
};
