-- 1. user7 등 dummy 데이터가 포함된 포스트의 닉네임을 '탐험가'로 강제 수정
UPDATE posts 
SET user_name = '탐험가' 
WHERE user_name ~* '^user\d+$';

-- 2. 문제의 고장난 이미지 ID가 포함된 포스트들을 삭제하거나 대체 이미지로 변경
-- 여기서는 문제가 되는 Unsplash ID를 가진 데이터를 모두 깨끗한 이미지로 대체합니다.
UPDATE posts 
SET image_url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=90'
WHERE image_url LIKE '%photo-1506057585508-85603cee9e17%';

-- 3. dummy 텍스트가 들어있는 content 정리
UPDATE posts 
SET content = '오늘의 멋진 순간을 기록합니다. 📍'
WHERE content ~* 'post\s*content';
