-- 1. posts 테이블의 모든 image_url과 images 데이터 중 잘못된 텍스트("Post content 1")를 가진 행들을 모두 실제 이미지로 교체합니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url LIKE '%Post content%' 
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL;

-- 2. images 배열 내부도 확인
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0 OR images[1] LIKE '%Post content%';

-- 3. user8의 포스팅을 특정하여 확실하게 고칩니다. (사용자 제보 기반)
UPDATE public.posts p
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
FROM public.profiles pr
WHERE p.user_id = pr.id::text AND pr.nickname = 'user8';
