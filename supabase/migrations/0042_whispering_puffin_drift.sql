-- 1. http로 시작하지 않는 모든 잘못된 이미지 데이터를 고화질 Unsplash 이미지로 강제 교체
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url NOT LIKE 'http%' 
  OR image_url LIKE '%Post content%'
  OR image_url IS NULL;

-- 2. images 배열 내부의 요소들도 검사하여 수정
UPDATE public.posts
SET images = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80']
WHERE images[1] NOT LIKE 'http%' OR images IS NULL;

-- 3. 특정 유저(user8 등)의 데이터가 꼬여있을 수 있으므로 전체 재점검
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80'
WHERE image_url LIKE '%Post content%';
