-- 모든 텍스트 기반 컬럼에서 'post'와 'content'가 같이 들어간 모든 행을 찾습니다.
SELECT id, content, image_url, images, user_name
FROM posts 
WHERE content ILIKE '%post%content%'
   OR image_url ILIKE '%post%content%'
   OR array_to_string(images, ',') ILIKE '%post%content%';
