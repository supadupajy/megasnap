-- 1. 해당 URL을 포함하고 있는 모든 포스팅 조회 (상세 확인용)
SELECT id, content, image_url, images FROM public.posts 
WHERE image_url LIKE '%photo-1548199973-03cbf5292374%' 
OR 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80' = ANY(images);

-- 2. 발견된 모든 데이터를 새로운 고화질 이미지로 강제 교체
UPDATE public.posts 
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id
WHERE image_url LIKE '%photo-1548199973-03cbf5292374%';

UPDATE public.posts 
SET images = array_replace(images, 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90&sig=' || id)
WHERE 'https://images.unsplash.com/photo-1548199973-03cbf5292374?auto=format&fit=crop&w=800&q=80' = ANY(images);