-- [FINAL ATTEMPT] 모든 잘못된 텍스트 기반 데이터를 원천적으로 삭제하거나 교체
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url NOT LIKE 'http%' 
  OR image_url LIKE '%Post content%'
  OR image_url IS NULL;

-- images 배열이 꼬인 경우도 강제 수정
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0 OR images[1] LIKE '%Post content%';
