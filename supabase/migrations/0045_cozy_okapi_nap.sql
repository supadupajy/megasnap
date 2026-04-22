-- 1. [강제] posts 테이블의 모든 잘못된 텍스트 이미지 데이터를 즉시 교체
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url LIKE '%Post content%' 
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL;

-- 2. [강제] images 배열 내부도 전수 조사하여 수정
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL 
  OR array_length(images, 1) = 0 
  OR images[1] LIKE '%Post content%'
  OR images[1] NOT LIKE 'http%';

-- 3. [보강] user20을 포함한 모든 유사 사례 일괄 처리
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE user_name LIKE 'user%' AND (image_url LIKE '%Post content%' OR image_url NOT LIKE 'http%');
