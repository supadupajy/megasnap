-- [FINAL] 모든 게시물의 이미지를 전수 조사하여 비정상 데이터(Post content 등)를 가진 행을 강제 교체합니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url ~* 'post content'
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL
  OR id IN (
    SELECT id FROM (
      SELECT id, unnest(images) as img FROM public.posts
    ) sub WHERE img ~* 'post content' OR img NOT LIKE 'http%'
  );

-- images 배열이 꼬인 경우(null이거나 빈 배열) image_url로 동기화
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0;
