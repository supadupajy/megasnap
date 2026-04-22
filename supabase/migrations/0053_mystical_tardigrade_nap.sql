-- [ULTIMATE NUCLEAR OPTION] 
-- 'Post content'가 포함된 모든 게시물을 완전히 삭제하거나 이미지를 원천적으로 교체합니다.

-- 1. 문제가 되는 텍스트가 포함된 모든 행을 실제 고화질 이미지 URL로 덮어씌웁니다. (대소문자 무시 정규식)
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url ~* 'post\s*content' 
  OR image_url NOT LIKE 'http%'
  OR EXISTS (
    SELECT 1 FROM unnest(images) AS img WHERE img ~* 'post\s*content' OR img NOT LIKE 'http%'
  );

-- 2. user48, user38 등 모든 'user'로 시작하는 더미 유저의 데이터를 전수 조사하여 수정합니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE user_name LIKE 'user%' AND (image_url ~* 'post\s*content' OR image_url NOT LIKE 'http%');

-- 3. 데이터베이스 통계를 갱신하여 인덱스 최적화 및 즉시 반영 유도
ANALYZE public.posts;
