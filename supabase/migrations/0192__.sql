
SELECT id, latitude, longitude, LEFT(content, 30) as content
FROM posts
WHERE longitude > 130 OR longitude < 124 OR latitude > 40 OR latitude < 33
ORDER BY longitude DESC
LIMIT 20;
