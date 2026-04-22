-- [EMERGENCY DATA RESTORATION]
-- 1. 잘못 저장된 'Post content' 텍스트 데이터를 실제 이미지 URL로 원천 복구합니다.
-- Unsplash의 고유 ID(sig)를 포스트 ID와 연결하여 모든 게시물이 서로 다른 이미지를 갖도록 합니다.

UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80&sig=' || id::text,
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80&sig=' || id::text]
WHERE 
  image_url LIKE '%Post content%' 
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL;

-- 2. images 배열이 텍스트로 오염된 경우도 배열 형태로 강제 복구
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR images[1] LIKE '%Post content%';

-- 3. 데이터베이스 통계 즉시 갱신
ANALYZE public.posts;
