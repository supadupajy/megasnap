-- 1. 모든 기존 포스트의 닉네임을 '탐험가'로 강제 통일 (user7, user47 등 완전 박멸)
UPDATE posts 
SET user_name = '탐험가' 
WHERE user_name IS NULL OR user_name ~* '^user\d+$' OR user_name ~* '^explorer_';

-- 2. 블랙리스트 이미지(photo-1506057585508-85603cee9e17)를 가진 모든 데이터 삭제 또는 교체
-- 이번에는 확실하게 삭제하여 더 이상 조회되지 않게 합니다.
DELETE FROM posts 
WHERE image_url LIKE '%photo-1506057585508-85603cee9e17%';

-- 3. 혹시 모를 프로필 테이블의 더미 닉네임도 정리
UPDATE profiles 
SET nickname = '탐험가' 
WHERE nickname ~* '^user\d+$' OR nickname ~* '^explorer_';
