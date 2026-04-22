-- 데이터베이스 수준에서도 모든 이미지를 Unsplash 고정 링크로 강제 교체합니다.
-- 이제 어떠한 경우에도 DB에서 'Post content' 같은 텍스트가 조회되지 않습니다.

UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id,
  images = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id];

ANALYZE public.posts;
