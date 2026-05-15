
SELECT COUNT(*) as total_posts,
  COUNT(CASE WHEN video_url IS NOT NULL AND video_url != '' THEN 1 END) as posts_with_video_url,
  COUNT(CASE WHEN image_url ILIKE '%.mp4' OR image_url ILIKE '%.mov' OR image_url ILIKE '%.webm' THEN 1 END) as posts_with_video_image
FROM posts;
