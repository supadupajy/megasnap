-- 1. [강제] posts 테이블의 모든 데이터를 대상으로 Post content 텍스트가 포함된 모든 컬럼을 실제 작동하는 이미지 URL로 덮어씌웁니다.
-- image_url 뿐만 아니라 images 배열 전체를 수정합니다.
UPDATE public.posts
SET 
  image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  images = ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80']
WHERE 
  image_url LIKE '%Post content%' 
  OR image_url NOT LIKE 'http%'
  OR image_url IS NULL
  OR EXISTS (
    SELECT 1 FROM unnest(images) as img WHERE img LIKE '%Post content%' OR img NOT LIKE 'http%'
  );

-- 2. [강제] 추가적으로 images 배열이 비어있거나 깨진 모든 행을 복구합니다.
UPDATE public.posts
SET images = ARRAY[image_url]
WHERE images IS NULL OR array_length(images, 1) = 0;

-- 3. [보강] 전체 테이블을 대상으로 다시 한 번 정밀 검수 (모든 user를 포함)
UPDATE public.posts
SET image_url = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80'
WHERE image_url NOT LIKE 'https://images.unsplash.com/%' AND image_url NOT LIKE 'https://i.ytimg.com/%' AND image_url NOT LIKE 'https://xzabikiuauxdbvncudsm.supabase.co/%';
