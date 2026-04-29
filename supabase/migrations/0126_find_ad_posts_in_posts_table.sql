
SELECT id, content, user_name, location_name, latitude, longitude, created_at, image_url, is_seed_data, user_id
FROM posts
WHERE content ILIKE '%[AD]%' OR content ILIKE '%sponsored%' OR user_name ILIKE '%sponsored%'
ORDER BY created_at DESC
LIMIT 20;
