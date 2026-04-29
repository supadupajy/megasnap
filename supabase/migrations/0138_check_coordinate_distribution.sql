
-- 좌표 분포 확인
SELECT 
  ROUND(latitude::numeric, 1) as lat_bucket,
  ROUND(longitude::numeric, 1) as lng_bucket,
  COUNT(*) as cnt
FROM posts
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
GROUP BY lat_bucket, lng_bucket
ORDER BY cnt DESC
LIMIT 20;
