-- 1. 데이터베이스 수준에서 "Post content" 텍스트를 가진 모든 이미지 필드를 원천적으로 삭제하고 실제 URL로 교체
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url ~* 'post\s*content' 
  OR EXISTS (
    SELECT 1 FROM unnest(images) AS img WHERE img ~* 'post\s*content'
  );

-- 2. "Post content 1" 등 비정상적인 데이터가 포함된 모든 행을 다시 한번 강제 업데이트
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE image_url NOT LIKE 'http%';
