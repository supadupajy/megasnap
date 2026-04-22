-- [THE ULTIMATE AND FINAL CLEANUP]
-- 모든 'Post content' 텍스트를 포함하는 데이터를 실제 고화질 이미지 URL로 강제 교환합니다.
-- 정규식을 사용하여 대소문자, 공백 등 모든 변종을 찾아냅니다.

-- 1. image_url 컬럼 클리닝
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'
WHERE image_url ~* 'post\s*content' 
   OR image_url NOT LIKE 'http%' 
   OR image_url IS NULL;

-- 2. images 배열 컬럼 클리닝
-- 배열 내 요소 중 하나라도 'post content'를 포함하면 배열 전체를 정상 이미지로 교체
UPDATE public.posts
SET images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE id IN (
  SELECT id FROM (
    SELECT id, unnest(images) as img FROM public.posts
  ) sub WHERE img ~* 'post\s*content' OR img NOT LIKE 'http%'
);

-- 3. images 배열이 비어있거나 null인 경우 image_url로 복구
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0;

-- 4. 특정 포스팅(user38 등) 데이터 전수 재검사 및 강제 업데이트
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE user_name LIKE 'user%' AND (image_url ~* 'post\s*content' OR image_url NOT LIKE 'http%');

-- 5. 변경 사항 즉시 반영을 위한 통계 갱신
ANALYZE public.posts;
