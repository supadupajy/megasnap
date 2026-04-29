
-- 실제 bounds 범위 테스트 (서울 중심 기준)
SELECT COUNT(*) as count_in_seoul
FROM posts
WHERE latitude >= 37.4 AND latitude <= 37.7
  AND longitude >= 126.8 AND longitude <= 127.2;
