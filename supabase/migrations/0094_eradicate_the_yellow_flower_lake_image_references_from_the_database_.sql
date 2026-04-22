-- [CRITICAL] 문제의 노란 꽃 호수 이미지를 참조하는 모든 포스트 삭제
DELETE FROM posts 
WHERE image_url LIKE '%photo-1501785888041-af3ef285b470%';

-- 유튜브 포스팅 중 이미지가 잘못 박힌 것들도 삭제 (재생성을 위해)
DELETE FROM posts 
WHERE youtube_url IS NOT NULL 
  AND (image_url LIKE '%unsplash.com%' OR image_url LIKE '%photo-1501785888041-af3ef285b470%');
