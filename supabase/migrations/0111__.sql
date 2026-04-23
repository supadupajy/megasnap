SELECT 
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE video_url IS NOT NULL) as video_posts,
    COUNT(*) FILTER (WHERE youtube_url IS NOT NULL) as youtube_posts,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as image_posts
FROM posts;