-- 1. 꽃 이미지 또는 깨진 링크로 의심되는 최근 포스팅 모두 삭제
DELETE FROM posts 
WHERE user_name = '탐험가' 
  AND created_at > now() - interval '2 hours';

-- 2. 명시적으로 Unsplash나 Pixabay의 예전 꽃 이미지 링크가 포함된 데이터 삭제
DELETE FROM posts 
WHERE image_url LIKE '%pixabay.com%' 
   OR image_url LIKE '%unsplash.com%';
