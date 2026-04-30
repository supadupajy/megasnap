
-- longitude가 NULL이거나 비정상적인 포스팅 확인
SELECT id, latitude, longitude, LEFT(content, 40) as content
FROM posts
WHERE longitude IS NULL OR latitude IS NULL
LIMIT 10;
