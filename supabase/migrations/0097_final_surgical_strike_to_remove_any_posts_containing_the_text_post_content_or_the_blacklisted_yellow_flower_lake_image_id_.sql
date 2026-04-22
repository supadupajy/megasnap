-- 1. 'Post content' 더미 텍스트가 포함된 모든 포스트 즉시 삭제 (스크린샷 증거 기반)
DELETE FROM posts WHERE content LIKE '%Post content%';

-- 2. 'Post content'가 포함된 content 컬럼을 가진 모든 포스트 삭제 (정규식 기반)
DELETE FROM posts WHERE content ~* 'post\s*content';

-- 3. 명시적으로 노란 꽃 호수(photo-1501785888041-af3ef285b470) 이미지를 참조하는 모든 데이터 삭제
DELETE FROM posts WHERE image_url LIKE '%photo-1501785888041-af3ef285b470%';

-- 4. 혹시 모를 짧은 비정상 이미지 URL (예: 'photo-xxxx') 만 가진 데이터 삭제
DELETE FROM posts WHERE length(image_url) < 30 AND youtube_url IS NULL;
