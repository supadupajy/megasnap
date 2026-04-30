
-- 경도가 가장 큰 포스팅들 (오른쪽 끝)
SELECT id, latitude, longitude, LEFT(content, 30) as content
FROM posts
ORDER BY longitude DESC
LIMIT 10;
