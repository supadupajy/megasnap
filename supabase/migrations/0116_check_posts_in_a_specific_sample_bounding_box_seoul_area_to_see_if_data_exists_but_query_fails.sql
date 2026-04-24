-- Sample Seoul-like area check
SELECT count(*) 
FROM posts 
WHERE latitude >= 37.4 AND latitude <= 37.6 
  AND longitude >= 126.8 AND longitude <= 127.2;

-- Check distribution of likes to see if they are mostly 0
SELECT likes, count(*) 
FROM posts 
GROUP BY likes 
ORDER BY likes DESC 
LIMIT 10;

-- Check a few posts to see their actual coordinates
SELECT id, latitude, longitude, location_name, likes 
FROM posts 
LIMIT 5;