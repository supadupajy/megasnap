-- DB 내의 모든 잔여 깨진 이미지 데이터를 강력하게 전수 교체
UPDATE public.posts 
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id,
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id]
WHERE image_url LIKE '%photo-1548199973-03cbf5292374%'
   OR 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80' = ANY(images);

-- 추가로 'Post content' 같은 더미 텍스트가 들어가 있는 필드도 청소
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id
WHERE image_url NOT LIKE 'http%';