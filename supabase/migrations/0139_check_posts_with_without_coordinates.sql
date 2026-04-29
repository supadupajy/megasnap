
SELECT COUNT(*) as total_posts,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as posts_with_coords,
  COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as posts_without_coords
FROM posts;
