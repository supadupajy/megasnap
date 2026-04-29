
SELECT COUNT(*) as total,
  SUM(CASE WHEN is_seed_data = true THEN 1 ELSE 0 END) as seed_count,
  SUM(CASE WHEN is_seed_data = false OR is_seed_data IS NULL THEN 1 ELSE 0 END) as real_count
FROM posts
WHERE content ILIKE '%[AD]%';
