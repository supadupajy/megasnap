-- 1. 모든 게시물(posts) 테이블에서 'Post content'가 포함된 데이터를 실제 URL로 강제 교체합니다.
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

-- 2. user21, user20, user6 등 모든 가상 유저의 데이터를 전수 조사하여 수정합니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE image_url LIKE '%Post content%' OR image_url NOT LIKE 'http%';

-- 3. 데이터 변경 후 인덱스 갱신하여 즉시 반영 유도
ANALYZE public.posts;
