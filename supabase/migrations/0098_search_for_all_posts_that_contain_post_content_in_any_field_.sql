-- 1. image_url 또는 content 컬럼에 'Post content'가 포함된 모든 데이터를 찾습니다.
SELECT id, user_name, content, image_url, location_name, created_at 
FROM posts 
WHERE content ~* 'post\s*content' 
   OR image_url ~* 'post\s*content'
ORDER BY created_at DESC;

-- 2. images 배열 컬럼 내부에도 해당 텍스트가 있는지 확인합니다.
SELECT id, user_name, images 
FROM posts 
WHERE 'Post content 1' = ANY(images) 
   OR 'Post content 2' = ANY(images);
