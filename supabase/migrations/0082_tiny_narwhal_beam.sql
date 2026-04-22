-- [CRITICAL] 'Post content'가 포함된 모든 image_url 및 images 배열을 고화질 Unsplash 이미지로 강제 교체
UPDATE public.posts 
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id,
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id]
WHERE image_url ILIKE '%Post content%'
   OR EXISTS (
     SELECT 1 FROM unnest(images) as img 
     WHERE img ILIKE '%Post content%'
   );

-- 추가로 URL 형식이 아닌 모든 쓰레기 데이터 청소
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1511497584788-915e57d2c9c5?auto=format&fit=crop&w=1200&q=90&sig=' || id,
  images = ARRAY['https://images.unsplash.com/photo-1511497584788-915e57d2c9c5?auto=format&fit=crop&w=1200&q=90&sig=' || id]
WHERE image_url NOT LIKE 'http%' 
   OR length(image_url) < 15;