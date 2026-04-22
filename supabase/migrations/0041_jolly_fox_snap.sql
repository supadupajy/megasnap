-- 1. posts 테이블의 모든 image_url과 images 데이터 중 빈 값이나 null인 경우를 확실히 제거하고 고정 이미지로 대체
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url IS NULL 
  OR image_url = '' 
  OR image_url = 'null'
  OR image_url = 'undefined'
  OR image_url LIKE '%source.unsplash.com%'
  OR image_url LIKE '%Post content%';

-- 2. images 배열 자체가 null이거나 비어있는 경우 image_url을 복사하여 채움
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) IS NULL;

-- 3. 혹시라도 'Post content' 라는 텍스트가 이미지 경로로 들어간 데이터가 있는지 확인하고 수정
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80'
WHERE image_url NOT LIKE 'http%';
