
-- latitude/longitude 컬럼 타입 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name IN ('latitude', 'longitude', 'id', 'likes', 'hot_since')
ORDER BY column_name;
