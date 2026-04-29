
-- bounds 쿼리 테스트: 서울 중심 반경 내 포스트 수 확인
SELECT COUNT(*) as count_in_seoul
FROM posts
WHERE latitude >= 37.4 AND latitude <= 37.7
  AND longitude >= 126.8 AND longitude <= 127.2;
