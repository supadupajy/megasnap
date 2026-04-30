
-- 전체 포스팅 수와 longitude 범위 확인
SELECT 
  COUNT(*) as total,
  MIN(longitude) as min_lng,
  MAX(longitude) as max_lng,
  MIN(latitude) as min_lat,
  MAX(latitude) as max_lat
FROM posts;
