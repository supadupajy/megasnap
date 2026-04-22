-- 1. [완전 초기화] posts 테이블의 모든 image_url과 images 필드를 검사하여 
-- 'Post content'가 포함된 데이터를 무조건 유효한 Unsplash URL로 덮어씁니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url ~* 'post content'
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL;

-- 2. images 배열 내부를 풀어서(unnest) 하나라도 잘못된 값이 있으면 배열 전체를 교체
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE id IN (
  SELECT id FROM (
    SELECT id, unnest(images) as img FROM public.posts
  ) sub WHERE img ~* 'post content' OR img NOT LIKE 'http%'
);

-- 3. [보강] URL이 아닌 텍스트가 들어간 모든 컬럼을 강제로 수정
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE image_url !~ '^https?://';
