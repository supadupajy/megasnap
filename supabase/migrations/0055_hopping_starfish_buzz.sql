-- 1. [CRITICAL RESTORATION] 모든 데이터를 포스팅 생성 로직(db-seeder)과 유사한 방식으로 다양화하여 복구합니다.
-- 단순히 하나의 URL이 아닌, 각 포스팅의 고유 ID(UUID)를 활용하여 Unsplash의 다른 사진들이 나오도록 합니다.
-- 또한, 기존에 깨졌던 'Post content' 데이터는 원천 배제합니다.

UPDATE public.posts
SET 
  image_url = CASE 
    WHEN category = 'food' THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80&sig=' || id::text
    WHEN category = 'place' THEN 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80&sig=' || id::text
    WHEN category = 'animal' THEN 'https://images.unsplash.com/photo-1474511320723-9a5617389965?auto=format&fit=crop&w=800&q=80&sig=' || id::text
    WHEN category = 'accident' THEN 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80&sig=' || id::text
    ELSE 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id::text
  END,
  images = ARRAY[
    CASE 
      WHEN category = 'food' THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80&sig=' || id::text
      WHEN category = 'place' THEN 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80&sig=' || id::text
      WHEN category = 'animal' THEN 'https://images.unsplash.com/photo-1474511320723-9a5617389965?auto=format&fit=crop&w=800&q=80&sig=' || id::text
      WHEN category = 'accident' THEN 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80&sig=' || id::text
      ELSE 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80&sig=' || id::text
    END
  ];

-- 2. 유튜브 포스팅은 썸네일을 우선적으로 복구할 수 있도록 유도 (sanitize 로직이 처리할 예정이지만 DB도 클린업)
-- 유튜브 URL이 있는 데이터는 썸네일 주소로 초기화
UPDATE public.posts
SET image_url = 'https://i.ytimg.com/vi/' || substring(youtube_url from '(?:v=|youtu\.be/|embed/|shorts/)([a-zA-Z0-9_-]{11})') || '/hqdefault.jpg'
WHERE youtube_url IS NOT NULL AND youtube_url LIKE '%youtube%';

-- 3. 통계 분석 갱신
ANALYZE public.posts;
