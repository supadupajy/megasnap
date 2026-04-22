-- 이미지 링크가 깨진 포스팅들을 일괄 수정합니다.
-- 1. image_url이 null이거나, 특정 깨진 패턴(unsplash source 등)을 포함하는 경우
-- 2. images 배열 내에 깨진 링크가 포함된 경우
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id,
  images = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id]
WHERE 
  image_url IS NULL 
  OR image_url = '' 
  OR image_url = 'null'
  OR image_url LIKE '%source.unsplash.com%'
  OR LENGTH(image_url) < 30;

-- images 배열이 비어있거나 깨진 경우도 동일하게 처리
UPDATE public.posts
SET 
  images = ARRAY[image_url]
WHERE 
  images IS NULL 
  OR array_length(images, 1) IS NULL;
