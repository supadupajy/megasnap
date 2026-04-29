
SELECT COUNT(*) as total, 
  COUNT(CASE WHEN latitude IS NULL THEN 1 END) as null_lat,
  COUNT(CASE WHEN longitude IS NULL THEN 1 END) as null_lng,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as valid_coords
FROM posts;
