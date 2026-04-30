
-- 당정섬 근처(lng 126.9~127.1) 오른쪽에 있는 포스팅들
SELECT id, latitude, longitude, LEFT(content, 40) as content
FROM posts
WHERE longitude > 127.05 AND longitude < 127.7
  AND latitude BETWEEN 37.4 AND 37.7
ORDER BY longitude ASC
LIMIT 20;
