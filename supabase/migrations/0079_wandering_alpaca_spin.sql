-- 1. 고장난 특정 Unsplash 이미지를 가진 포스팅들을 찾아 새로운 고화질 이미지로 교체
UPDATE public.posts 
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id
WHERE image_url LIKE '%photo-1548199973-03cbf5292374%';

-- 2. "images" 배열 컬럼 내에 해당 링크가 포함된 경우도 처리
UPDATE public.posts 
SET images = array_replace(images, 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id)
WHERE 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80' = ANY(images);
