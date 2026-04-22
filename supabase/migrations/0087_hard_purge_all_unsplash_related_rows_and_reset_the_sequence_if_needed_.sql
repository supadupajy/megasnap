-- 1. Unsplash URL을 가진 모든 데이터를 아예 삭제합니다. (업데이트가 아닌 삭제)
DELETE FROM posts WHERE image_url LIKE '%unsplash.com%';

-- 2. profiles 테이블에서도 unsplash를 참조하는 아바타가 있다면 기본값으로 변경
UPDATE profiles SET avatar_url = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg'
WHERE avatar_url LIKE '%unsplash.com%';
