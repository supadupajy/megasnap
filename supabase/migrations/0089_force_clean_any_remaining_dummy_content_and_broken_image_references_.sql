-- 1. 'Post content' 더미 텍스트가 포함된 모든 포스트 삭제
DELETE FROM posts WHERE content LIKE 'Post content%';

-- 2. 블랙리스트 이미지를 여전히 참조하는 포스트 삭제
DELETE FROM posts WHERE image_url LIKE '%photo-1506057585508-85603cee9e17%';

-- 3. 유효하지 않은 짧은 image_url(Unsplash ID만 있는 경우 등) 정리
DELETE FROM posts WHERE length(image_url) < 30 AND youtube_url IS NULL;
