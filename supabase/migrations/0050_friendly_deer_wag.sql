-- [ULTIMATE DB FIX] 
-- 'Post content'가 포함된 모든 이미지 데이터를 실제 작동하는 고화질 이미지 주소로 '완전 강제 교체' 합니다.

-- 1. image_url 필드 수정
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'
WHERE image_url ~* 'post\s*content' 
   OR image_url NOT LIKE 'http%'
   OR image_url IS NULL;

-- 2. images 배열 필드 수정 (배열 내 요소 중 하나라도 잘못된 경우 배열 전체를 교체)
UPDATE public.posts
SET images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE id IN (
  SELECT id FROM (
    SELECT id, unnest(images) as img FROM public.posts
  ) sub WHERE img ~* 'post\s*content' OR img NOT LIKE 'http%'
);

-- 3. images 배열이 null인 경우 보정
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0;

-- 4. 특정 포스팅(user20, user6 등) 뿐만 아니라 전체 테이블을 다시 한 번 클린업
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80'
WHERE image_url LIKE '%Post content%';
